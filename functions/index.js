"use strict";

const crypto = require("node:crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");
const {
  getIntegration,
  isAllowedOrigin,
  normalizeOrigin,
  publicIntegrationConfig
} = require("./integrations");
const { signSession, verifySession } = require("./session-token");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const AIPANDU_SESSION_SECRET = defineSecret("AIPANDU_SESSION_SECRET");
const REGION = "us-central1";
const MODEL = process.env.AIPANDU_MODEL || "gpt-5.6-luna";
const MAX_QUERY_CHARS = 1200;
const MAX_HISTORY_ITEMS = 6;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_REQUESTS = 24;
const rateBuckets = new Map();

function sendJson(res, status, payload) {
  res.status(status);
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  return res.json(payload);
}

function requestOrigin(req) {
  return normalizeOrigin(req.get("origin") || "");
}

function applySessionCors(req, res, integration) {
  const origin = requestOrigin(req);
  if (origin && isAllowedOrigin(integration, origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return origin;
}

function bearerToken(req) {
  const match = String(req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function requireSession(req) {
  const token = bearerToken(req);
  if (!token) {
    const error = new Error("Missing aiPandu session.");
    error.statusCode = 401;
    throw error;
  }
  const session = verifySession(token, AIPANDU_SESSION_SECRET.value());
  const integration = getIntegration(session.appKey);
  if (!integration || !isAllowedOrigin(integration, session.origin)) {
    const error = new Error("This aiPandu integration is not available for the requesting site.");
    error.statusCode = 403;
    throw error;
  }
  return { session, integration };
}

function clientIp(req) {
  return String(req.get("x-forwarded-for") || req.ip || "unknown").split(",")[0].trim();
}

function enforceRateLimit(req, session) {
  const now = Date.now();
  const key = crypto.createHash("sha256").update(`${session.appKey}|${session.origin}|${clientIp(req)}`).digest("hex");
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  current.count += 1;
  if (current.count > RATE_MAX_REQUESTS) {
    const error = new Error("Too many questions were sent. Please wait a few minutes and try again.");
    error.statusCode = 429;
    throw error;
  }
  if (rateBuckets.size > 2000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
  }
}

function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_HISTORY_ITEMS).map(item => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: String(item?.content || "").trim().slice(0, 1600)
  })).filter(item => item.content);
}

async function retrieveContext(integration, query) {
  const rag = integration.rag;
  const response = await fetch(rag.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      docIds: [...rag.docIds],
      appId: rag.appId,
      tenantId: rag.tenantId,
      visibilityScope: [...rag.visibilityScope],
      topK: rag.topK,
      maxDocuments: rag.maxDocuments,
      maxChunksPerDocument: rag.maxChunksPerDocument,
      maxRetrievedTokens: rag.maxRetrievedTokens
    }),
    signal: AbortSignal.timeout(25000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `RAG retrieval failed (${response.status}).`);
  return Array.isArray(data.results) ? data.results : [];
}

function buildContext(results) {
  return results.map((result, index) => {
    const title = result.title || result.citationLabel || result.docId || `Source ${index + 1}`;
    const heading = result.heading || result.sectionTitle || "";
    return `[${index + 1}] ${title}${heading ? ` — ${heading}` : ""}\n${String(result.text || "").trim()}`;
  }).join("\n\n");
}

function buildInput(query, history, context, productName) {
  const recent = history.length
    ? history.map(item => `${item.role === "assistant" ? "Assistant" : "User"}: ${item.content}`).join("\n")
    : "No earlier conversation.";
  return `Recent conversation:\n${recent}\n\nUser question:\n${query}\n\nRetrieved ${productName} guidance:\n${context}`;
}

function citationList(results) {
  const seen = new Set();
  const citations = [];
  results.forEach((result, index) => {
    const key = `${result.docId}|${result.heading || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    citations.push({
      number: index + 1,
      docId: result.docId || "",
      title: result.title || result.citationLabel || result.docId || `Source ${index + 1}`,
      heading: result.heading || result.sectionTitle || "",
      sourceUrl: result.sourceUrl || result.source?.url || ""
    });
  });
  return citations;
}

exports.aiPanduSession = onRequest({
  region: REGION,
  timeoutSeconds: 30,
  secrets: [AIPANDU_SESSION_SECRET]
}, async (req, res) => {
  const appKey = String(req.query.appKey || "").trim().toLowerCase();
  const integration = getIntegration(appKey);
  const origin = applySessionCors(req, res, integration);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "GET") return sendJson(res, 405, { error: "GET required." });
  if (!integration) return sendJson(res, 404, { error: "Unknown aiPandu integration." });
  if (!origin || !isAllowedOrigin(integration, origin)) {
    return sendJson(res, 403, { error: "aiPandu is not enabled for this website." });
  }
  try {
    const token = signSession({ appKey, origin }, AIPANDU_SESSION_SECRET.value());
    return sendJson(res, 200, { token, expiresIn: 1800 });
  } catch (error) {
    console.error("aiPanduSession failed", error);
    return sendJson(res, 500, { error: "Unable to start aiPandu." });
  }
});

exports.aiPanduConfig = onRequest({ region: REGION, timeoutSeconds: 30, secrets: [AIPANDU_SESSION_SECRET] }, async (req, res) => {
  if (req.method !== "GET") return sendJson(res, 405, { error: "GET required." });
  try {
    const { integration } = requireSession(req);
    return sendJson(res, 200, { integration: publicIntegrationConfig(integration) });
  } catch (error) {
    return sendJson(res, Number(error.statusCode || 401), { error: error.message || "Invalid aiPandu session." });
  }
});

exports.aiPanduChat = onRequest({
  region: REGION,
  timeoutSeconds: 90,
  memory: "512MiB",
  secrets: [OPENAI_API_KEY, AIPANDU_SESSION_SECRET]
}, async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST required." });
  try {
    const { session, integration } = requireSession(req);
    enforceRateLimit(req, session);
    const query = String(req.body?.query || "").trim();
    if (!query) return sendJson(res, 400, { error: "Enter a question." });
    if (query.length > MAX_QUERY_CHARS) return sendJson(res, 400, { error: `Keep the question under ${MAX_QUERY_CHARS} characters.` });
    const history = cleanHistory(req.body?.history);
    const results = await retrieveContext(integration, query);
    if (!results.length) {
      return sendJson(res, 200, {
        answer: `I could not find relevant guidance in the ${integration.productName} help documents. Try describing the menu or action you are using.`,
        citations: []
      });
    }
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    const safetyIdentifier = crypto.createHash("sha256").update(`${session.appKey}|${session.origin}`).digest("hex").slice(0, 64);
    const sourceInstruction = integration.showSources === false
      ? "Do not add citation numbers or source markers to the answer."
      : "Cite supporting passages using [1], [2], and so on.";
    const response = await openai.responses.create({
      model: MODEL,
      store: false,
      reasoning: { effort: "low" },
      text: { verbosity: "medium" },
      max_output_tokens: 900,
      safety_identifier: safetyIdentifier,
      instructions: `You are aiPandu, a practical guide for ${integration.productName}. Answer only from the retrieved guidance. Give direct, numbered steps when the user asks how to do something. Explain which menu or learner area to use when relevant. ${sourceInstruction} If the guidance does not contain the answer, say so plainly and ask one useful follow-up question. Do not invent controls, access rules, or product behaviour. ${integration.scopeInstruction || ""}`.trim(),
      input: buildInput(query, history, buildContext(results), integration.productName)
    });
    const answer = String(response.output_text || "").trim();
    if (!answer) throw new Error("The model returned an empty answer.");
    return sendJson(res, 200, {
      answer,
      citations: integration.showSources === false ? [] : citationList(results),
      knowledgeBaseId: integration.knowledgeBaseId,
      model: MODEL
    });
  } catch (error) {
    console.error("aiPanduChat failed", error);
    const status = Number(error.statusCode || 500);
    return sendJson(res, status >= 400 && status < 600 ? status : 500, {
      error: status === 500 ? "aiPandu could not answer just now. Please try again." : error.message
    });
  }
});
