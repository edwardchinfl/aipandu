"use strict";

const crypto = require("node:crypto");

const encode = value => Buffer.from(value).toString("base64url");
const decode = value => Buffer.from(value, "base64url").toString("utf8");

function signSession(payload, secret, ttlSeconds = 1800, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret || String(secret).length < 32) throw new Error("Session secret must contain at least 32 characters.");
  const body = {
    v: 1,
    appKey: String(payload.appKey || ""),
    origin: String(payload.origin || ""),
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
    nonce: crypto.randomBytes(8).toString("hex")
  };
  const encoded = encode(JSON.stringify(body));
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySession(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const [encoded, signature, extra] = String(token || "").split(".");
  if (!encoded || !signature || extra) throw new Error("Invalid session token.");
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error("Invalid session signature.");
  }
  let payload;
  try {
    payload = JSON.parse(decode(encoded));
  } catch (_error) {
    throw new Error("Invalid session payload.");
  }
  if (payload.v !== 1 || !payload.appKey || !payload.origin) throw new Error("Incomplete session payload.");
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) throw new Error("Session expired.");
  if (!Number.isFinite(payload.iat) || payload.iat > nowSeconds + 60) throw new Error("Invalid session time.");
  return payload;
}

module.exports = { signSession, verifySession };

