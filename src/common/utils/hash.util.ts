import { createHash, randomBytes } from 'node:crypto';

/**
 * Deterministic SHA-256 hex digest. Used to store opaque refresh/auth tokens
 * as hashes so the raw token never touches the database.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Generates a cryptographically random, URL-safe opaque token.
 * Defaults to 32 bytes (256 bits) of entropy.
 */
export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}
