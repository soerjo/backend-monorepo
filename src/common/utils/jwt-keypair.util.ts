import { readFileSync } from 'node:fs';
import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';

export interface JwtRsaKeySource {
  privateKey?: string | null;
  privateKeyPath?: string | null;
}

export interface JwtRsaKeypair {
  privateKey: string;
  publicKey: string;
}

const MIN_RSA_MODULUS_LENGTH = 2048;

function normalizePem(value: string): string {
  const trimmed = value.trim();
  return trimmed.includes('\n') ? trimmed : trimmed.replace(/\\n/g, '\n');
}

function readPrivateKeyFile(path: string): string {
  return normalizePem(readFileSync(path, 'utf8'));
}

/**
 * Resolves the RS256 signing keypair from the environment:
 * - `UMS_JWT_PRIVATE_KEY_PATH` wins when set and the file is readable
 * - otherwise the inline `UMS_JWT_PRIVATE_KEY` PEM is used
 * The public key is derived from the private key so there is a single
 * source of truth for verification.
 */
export function loadJwtRsaKeypair(source: JwtRsaKeySource): JwtRsaKeypair {
  const inline = source.privateKey?.trim()
    ? normalizePem(source.privateKey)
    : undefined;
  const path = source.privateKeyPath?.trim();

  let privateKeyPem = inline;
  let fileError: string | undefined;

  if (path) {
    try {
      const fromFile = readPrivateKeyFile(path);
      if (fromFile) {
        privateKeyPem = fromFile;
      } else {
        fileError = 'file is empty';
      }
    } catch (error) {
      fileError = error instanceof Error ? error.message : String(error);
    }
  }

  if (!privateKeyPem) {
    const details = fileError
      ? ` Reading UMS_JWT_PRIVATE_KEY_PATH failed: ${fileError}.`
      : '';
    throw new Error(
      'JWT RSA keypair is not configured: set UMS_JWT_PRIVATE_KEY (inline PEM) ' +
        `or UMS_JWT_PRIVATE_KEY_PATH (path to a PEM file); at least one is required.${details}`,
    );
  }

  let privateKeyObject: KeyObject;
  try {
    privateKeyObject = createPrivateKey(privateKeyPem);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `JWT private key is not a valid PEM private key: ${reason}`,
    );
  }

  if (privateKeyObject.asymmetricKeyType !== 'rsa') {
    throw new Error(
      `JWT private key must be an RSA key for RS256 signing, got "${privateKeyObject.asymmetricKeyType}".`,
    );
  }

  const modulusLength = privateKeyObject.asymmetricKeyDetails?.modulusLength;
  if (modulusLength !== undefined && modulusLength < MIN_RSA_MODULUS_LENGTH) {
    throw new Error(
      `JWT RSA private key is too small (${modulusLength} bits); at least ${MIN_RSA_MODULUS_LENGTH} bits are required.`,
    );
  }

  const publicKey = createPublicKey(privateKeyObject)
    .export({ type: 'spki', format: 'pem' })
    .toString();

  return { privateKey: privateKeyPem, publicKey };
}
