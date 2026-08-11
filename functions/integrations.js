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
  PETIPETI_DOCUMENT_IDS,
  getIntegration,
  isAllowedOrigin,
  normalizeOrigin,
  publicIntegrationConfig
};
