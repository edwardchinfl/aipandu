"use strict";

const PETIPETI_DOCUMENT_IDS = Object.freeze([
  "ttinfo_petipeti_overview_navigation_v1",
  "ttinfo_petipeti_creating_structuring_boxes_v1",
  "ttinfo_petipeti_box_layout_sizing_v1",
  "ttinfo_petipeti_colours_backgrounds_images_v1",
  "ttinfo_petipeti_fonts_text_formatting_v1",
  "ttinfo_petipeti_borders_spacing_corners_shadows_v1",
  "ttinfo_petipeti_moving_reorganising_boxes_v1",
  "ttinfo_petipeti_saving_opening_sharing_exporting_v1",
  "ttinfo_petipeti_troubleshooting_faq_v1"
]);

const AICEKAP_LEARNER_DOCUMENT_IDS = Object.freeze([
  "aipandu_aicekap_getting_started_v1",
  "aipandu_aicekap_cekap_framework_v1",
  "aipandu_aicekap_missions_selection_v1",
  "aipandu_aicekap_execution_feedback_v1",
  "aipandu_aicekap_scores_progress_v1",
  "aipandu_aicekap_games_workshops_guides_v1",
  "aipandu_aicekap_access_troubleshooting_v1",
  "aipandu_aicekap_learner_faq_v1"
]);

const INTEGRATIONS = Object.freeze({
  petipeti: Object.freeze({
    appKey: "petipeti",
    productName: "Peti-Peti",
    assistantName: "aiPandu",
    knowledgeBaseId: "petipeti-help",
    welcomeMessage: "Hello! I can guide you through Peti-Peti—boxes, layouts, colours, fonts, saving, sharing and more.",
    placeholder: "Ask how to use Peti-Peti…",
    suggestions: Object.freeze([
      "How do I arrange three boxes in a row?",
      "How do I change a box background colour?",
      "How do I save and share my page?"
    ]),
    allowedOrigins: Object.freeze([
      "https://peti-peti.com",
      "https://www.peti-peti.com",
      "https://nestedboxes-99ea8.web.app",
      "https://nestedboxes-99ea8.firebaseapp.com",
      "https://peti-peti--aipandu-test-20260811-gx0bzksx.web.app",
      "https://aipandu.web.app",
      "https://aipandu.firebaseapp.com"
    ]),
    allowLocalhost: true,
    rag: Object.freeze({
      endpoint: "https://us-central1-nestedboxes-99ea8.cloudfunctions.net/ragRetrieve",
      appId: "ttinfochat",
      tenantId: "ttinfo",
      visibilityScope: Object.freeze(["global", "app", "tenant"]),
      docIds: PETIPETI_DOCUMENT_IDS,
      topK: 6,
      maxDocuments: 4,
      maxChunksPerDocument: 3,
      maxRetrievedTokens: 6500
    })
  }),
  aicekap: Object.freeze({
    appKey: "aicekap",
    productName: "aiCEKAP",
    assistantName: "aiPandu",
    knowledgeBaseId: "aicekap-learner-help",
    welcomeMessage: "Hello! I can help you use aiCEKAP as a learner—from choosing a mission to improving your prompt and understanding your progress.",
    placeholder: "Ask how to learn with aiCEKAP…",
    suggestions: Object.freeze([
      "How do I complete my first mission?",
      "How can I improve a low CEKAP score?",
      "Why is my next stage still locked?"
    ]),
    allowedOrigins: Object.freeze([
      "https://aicekap.com",
      "https://www.aicekap.com",
      "https://aicekap2026.web.app",
      "https://aicekap2026.firebaseapp.com",
      "https://aicekap2026--aipandu-learner-20260811-awv24duq.web.app",
      "https://aipandu.web.app",
      "https://aipandu.firebaseapp.com"
    ]),
    allowLocalhost: true,
    scopeInstruction: "Support learners only. Do not provide procedures for admin settings, user approvals, company configuration, mission publishing, analytics, RAG management, Firestore, deployments, permissions, tokens, or API keys. If asked about one of those topics, explain that this learner guide does not cover it and direct the user to their facilitator or system administrator.",
    rag: Object.freeze({
      endpoint: "https://us-central1-nestedboxes-99ea8.cloudfunctions.net/ragRetrieve",
      appId: "aipandu",
      tenantId: "aicekap",
      visibilityScope: Object.freeze(["global", "app", "tenant"]),
      docIds: AICEKAP_LEARNER_DOCUMENT_IDS,
      topK: 6,
      maxDocuments: 4,
      maxChunksPerDocument: 3,
      maxRetrievedTokens: 6500
    })
  })
});

function getIntegration(appKey) {
  return INTEGRATIONS[String(appKey || "").trim().toLowerCase()] || null;
}

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || ""));
    return url.origin.toLowerCase();
  } catch (_error) {
    return "";
  }
}

function isAllowedOrigin(integration, origin) {
  const normalized = normalizeOrigin(origin);
  if (!integration || !normalized) return false;
  if (integration.allowedOrigins.includes(normalized)) return true;
  if (!integration.allowLocalhost) return false;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized);
}

function publicIntegrationConfig(integration) {
  return {
    appKey: integration.appKey,
    productName: integration.productName,
    assistantName: integration.assistantName,
    knowledgeBaseId: integration.knowledgeBaseId,
    welcomeMessage: integration.welcomeMessage,
    placeholder: integration.placeholder,
    suggestions: [...integration.suggestions]
  };
}

module.exports = {
  INTEGRATIONS,
  AICEKAP_LEARNER_DOCUMENT_IDS,
  PETIPETI_DOCUMENT_IDS,
  getIntegration,
  isAllowedOrigin,
  normalizeOrigin,
  publicIntegrationConfig
};
