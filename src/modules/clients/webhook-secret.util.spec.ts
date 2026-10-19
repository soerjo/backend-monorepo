import {
  decryptWebhookSecret,
  deriveWebhookEncryptionKey,
  encryptWebhookSecret,
} from './webhook-secret.util.js';

describe('webhook-secret.util', () => {
  const key = deriveWebhookEncryptionKey('unit-test-key-material');

  it('round-trips the secret through AES-256-GCM', () => {
    const payload = encryptWebhookSecret('whsec_123', key);
    expect(decryptWebhookSecret(payload, key)).toBe('whsec_123');
  });

  it('uses a fresh IV per call', () => {
    expect(encryptWebhookSecret('same', key)).not.toEqual(
      encryptWebhookSecret('same', key),
    );
  });

  it('fails to decrypt with a different key', () => {
    const payload = encryptWebhookSecret('secret', key);
    const otherKey = deriveWebhookEncryptionKey('other-key-material');
    expect(() => decryptWebhookSecret(payload, otherKey)).toThrow();
  });
});
