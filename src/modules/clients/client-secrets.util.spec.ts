import {
  generateClientId,
  generateClientSecret,
  hashSecret,
  verifySecretHash,
} from './client-secrets.util.js';

describe('client-secrets.util', () => {
  it('generates svc_ prefixed client ids', () => {
    expect(generateClientId()).toMatch(/^svc_[0-9a-f]{24}$/);
  });

  it('generates distinct 32-byte secrets', () => {
    const first = generateClientSecret();
    const second = generateClientSecret();
    expect(first).not.toEqual(second);
    expect(Buffer.from(first, 'base64url')).toHaveLength(32);
  });

  it('hashes deterministically to a 64-char digest', () => {
    const secret = generateClientSecret();
    expect(hashSecret(secret)).toHaveLength(64);
    expect(hashSecret(secret)).toEqual(hashSecret(secret));
  });

  it('verifies a matching secret', () => {
    const secret = generateClientSecret();
    expect(verifySecretHash(secret, hashSecret(secret))).toBe(true);
  });

  it('rejects a mismatched secret', () => {
    expect(verifySecretHash('wrong', hashSecret('right'))).toBe(false);
  });

  it('rejects a malformed hash without throwing', () => {
    expect(verifySecretHash('secret', 'not-a-hash')).toBe(false);
  });
});
