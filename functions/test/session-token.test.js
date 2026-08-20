"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { signSession, verifySession } = require("../session-token");
const { getIntegration, isAllowedOrigin, normalizeOrigin } = require("../integrations");

const secret = "test-secret-that-is-long-enough-for-hmac-signing";

test("session token round-trips and preserves origin", () => {
  const token = signSession({ appKey: "petipeti", origin: "https://peti-peti.com" }, secret, 1800, 1000);
  const payload = verifySession(token, secret, 1100);
  assert.equal(payload.appKey, "petipeti");
  assert.equal(payload.origin, "https://peti-peti.com");
});

test("expired session token is rejected", () => {
  const token = signSession({ appKey: "petipeti", origin: "https://peti-peti.com" }, secret, 10, 1000);
  assert.throws(() => verifySession(token, secret, 1011), /expired/i);
});

test("tampered session token is rejected", () => {
  const token = signSession({ appKey: "petipeti", origin: "https://peti-peti.com" }, secret, 1800, 1000);
  assert.throws(() => verifySession(`${token}x`, secret, 1100), /signature|token/i);
});

test("Peti-Peti origins and localhost are allowed", () => {
  const integration = getIntegration("petipeti");
  assert.equal(integration.rag.appId, "petipeti-aipandu");
  assert.equal(isAllowedOrigin(integration, "https://peti-peti.com"), true);
  assert.equal(isAllowedOrigin(integration, "https://peti-peti--hosting-boundaries-20260820-tkz92rk4.web.app"), true);
  assert.equal(isAllowedOrigin(integration, "https://peti-peti--aipandu-test-20260811-gx0bzksx.web.app"), true);
  assert.equal(isAllowedOrigin(integration, "http://localhost:8080"), true);
  assert.equal(isAllowedOrigin(integration, "https://example.com"), false);
});

test("aiCEKAP uses its dedicated RAG app and allows localhost", () => {
  const integration = getIntegration("aicekap");
  assert.equal(integration.rag.appId, "aicekap-aipandu");
  assert.equal(
    integration.welcomeMessage,
    "Hello! I’m aiPandu, your aiCekap guide. I can help you understand your missions, build better prompts, interpret your scores and get more value from AI as your thinking partner."
  );
  assert.deepEqual(integration.suggestions, [
    "How can I write a better CEKAP prompt?",
    "What do my score and feedback mean?",
    "Can you help me understand this mission?"
  ]);
  assert.equal(isAllowedOrigin(integration, "https://aicekap.com"), true);
  assert.equal(isAllowedOrigin(integration, "https://aicekap2026.web.app"), true);
  assert.equal(isAllowedOrigin(integration, "https://aicekap2026--hosting-boundaries-20260820-0kbtqucz.web.app"), true);
  assert.equal(isAllowedOrigin(integration, "https://peti-peti-test--hosting-boundaries-20260820-kf97en2l.web.app"), true);
  assert.equal(isAllowedOrigin(integration, "http://localhost:8080"), true);
  assert.equal(isAllowedOrigin(integration, "https://example.com"), false);
});

test("origin normalization drops paths and normalizes case", () => {
  assert.equal(normalizeOrigin("HTTPS://PETI-PETI.COM/some/page"), "https://peti-peti.com");
});
