import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';

/**
 * Derives a deterministic 32-byte AES-256 key from APP_ENCRYPTION_KEY.
 */
export function deriveEncryptionKey(appKey: string): Buffer {
  return createHash('sha256').update(appKey).digest();
}

export function encryptSecret(plain: string, appKey: string): string {
  const key = deriveEncryptionKey(appKey);
  const iv = Buffer.from(
    createHash('md5')
      .update(plain + appKey)
      .digest(),
  ).subarray(0, 12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(encrypted: string, appKey: string): string {
  const key = deriveEncryptionKey(appKey);
  const buf = Buffer.from(encrypted, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}
