// Test double for `otplib` — avoids pulling ESM-only deps (@scure/base) into
// ts-jest. Unit tests exercise MFA logic with a fixed secret; real TOTP
// correctness is covered by CI e2e / integration, not the unit mock.
const { createHash } = require('node:crypto');

function generateSecret(len = 16) {
  // Deterministic base32-looking secret for tests.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let out = '';
  for (let i = 0; i < len; i += 1) out += chars[i % chars.length];
  return out;
}

function generateURI({ issuer, label, secret }) {
  return `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`;
}

function verify(_token, _secret) {
  return true;
}

module.exports = { generateSecret, generateURI, verify };
