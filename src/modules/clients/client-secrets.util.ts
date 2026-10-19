import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  generateOpaqueToken,
  sha256Hex,
} from '../../common/utils/hash.util.js';

const CLIENT_ID_PREFIX = 'svc_';
const CLIENT_ID_BYTES = 12;

export function generateClientId(): string {
  return `${CLIENT_ID_PREFIX}${randomBytes(CLIENT_ID_BYTES).toString('hex')}`;
}

export function generateClientSecret(): string {
  return generateOpaqueToken(32);
}

export function hashSecret(secret: string): string {
  return sha256Hex(secret);
}

export function verifySecretHash(
  secret: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(sha256Hex(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
