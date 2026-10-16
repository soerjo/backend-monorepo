import { createHash, createPublicKey } from 'node:crypto';

export interface RsaPublicJwk {
  kty: 'RSA';
  use: 'sig';
  alg: 'RS256';
  kid: string;
  n: string;
  e: string;
}

export interface JwksDocument {
  keys: RsaPublicJwk[];
}

interface ExportedRsaJwk {
  kty: string;
  n?: string;
  e?: string;
}

/**
 * RFC 7638 JWK thumbprint (SHA-256, base64url) over the required RSA members.
 * Used as the `kid` so token headers and the JWKS document always agree.
 */
function computeThumbprint(jwk: ExportedRsaJwk): string {
  const thumbprintInput = JSON.stringify({
    e: jwk.e,
    kty: jwk.kty,
    n: jwk.n,
  });
  return createHash('sha256').update(thumbprintInput).digest('base64url');
}

export function publicKeyToJwk(publicKeyPem: string): RsaPublicJwk {
  const exported = createPublicKey(publicKeyPem).export({
    format: 'jwk',
  }) as ExportedRsaJwk;

  if (exported.kty !== 'RSA' || !exported.n || !exported.e) {
    throw new Error('Public key is not an RSA key; cannot build a JWK.');
  }

  return {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid: computeThumbprint(exported),
    n: exported.n,
    e: exported.e,
  };
}

export function computeKeyId(publicKeyPem: string): string {
  return publicKeyToJwk(publicKeyPem).kid;
}

export function buildJwks(publicKeyPem: string): JwksDocument {
  return { keys: [publicKeyToJwk(publicKeyPem)] };
}
