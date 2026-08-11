"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { signSession, verifySession } = require("../session-token");
const { getIntegration, isAllowedOrigin, normalizeOrigin, publicIntegrationConfig } = require("../integrations");

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
  assert.equal(isAllowedOrigin(integration, "https://peti-peti.com"), true);
  assert.equal(isAllowedOrigin(integration, "https://peti-peti--aipandu-test-20260811-gx0bzksx.web.app"), true);
  assert.equal(isAllowedOrigin(integration, "http://localhost:8080"), true);
  assert.equal(isAllowedOrigin(integration, "https://example.com"), false);
});

test("aiCEKAP origins and localhost are allowed", () => {
  const integration = getIntegration("aicekap");
  assert.equal(isAllowedOrigin(integration, "https://aicekap.com"), true);
  assert.equal(isAllowedOrigin(integration, "https://aicekap2026.web.app"), true);
  assert.equal(isAllowedOrigin(integration, "https://aicekap2026--aipandu-learner-20260811-awv24duq.web.app"), true);
  assert.equal(isAllowedOrigin(integration, "http://localhost"), true);
  assert.equal(isAllowedOrigin(integration, "https://example.com"), false);
  assert.equal(publicIntegrationConfig(integration).showSources, false);
});

test("Peti-Peti sources are suppressed", () => {
  assert.equal(publicIntegrationConfig(getIntegration("petipeti")).showSources, false);
});

test("origin normalization drops paths and normalizes case", () => {
  assert.equal(normalizeOrigin("HTTPS://PETI-PETI.COM/some/page"), "https://peti-peti.com");
});
