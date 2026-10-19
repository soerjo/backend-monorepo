import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

const HKDF_SALT = Buffer.from('ums-service/webhook-secret');
const HKDF_INFO = Buffer.from('aes-256-gcm');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Derives a dedicated AES-256-GCM key from key material that never leaves the
 * service, so webhook signing secrets can be recovered for HMAC without being
 * stored in plaintext.
 */
export function deriveWebhookEncryptionKey(inputKeyMaterial: string): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(inputKeyMaterial, 'utf8'),
      HKDF_SALT,
      HKDF_INFO,
      32,
    ),
  );
}

export function encryptWebhookSecret(secret: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptWebhookSecret(payload: string, key: Buffer): string {
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
