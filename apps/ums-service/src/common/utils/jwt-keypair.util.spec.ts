import {
  generateKeyPairSync,
  type KeyObject,
  type KeyPairKeyObjectResult,
} from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadJwtRsaKeypair } from './jwt-keypair.util.js';

function generateRsaPemKeypair(): { privatePem: string; publicPem: string } {
  const { privateKey, publicKey }: KeyPairKeyObjectResult = generateKeyPairSync(
    'rsa',
    { modulusLength: 2048 },
  );
  return {
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

describe('loadJwtRsaKeypair', () => {
  const { privatePem, publicPem } = generateRsaPemKeypair();
  let scratchDir: string;

  beforeEach(() => {
    scratchDir = mkdtempSync(join(tmpdir(), 'jwt-keypair-'));
  });

  afterEach(() => {
    rmSync(scratchDir, { recursive: true, force: true });
  });

  it('derives the public key from an inline private key', () => {
    const keypair = loadJwtRsaKeypair({ privateKey: privatePem });

    expect(keypair.privateKey).toContain('BEGIN PRIVATE KEY');
    expect(keypair.publicKey).toContain('BEGIN PUBLIC KEY');
    expect(keypair.publicKey).toBe(publicPem);
  });

  it('prefers the key file over the inline key when the path is readable', () => {
    const filePair = generateRsaPemKeypair();
    const keyPath = join(scratchDir, 'private.pem');
    writeFileSync(keyPath, filePair.privatePem);

    const keypair = loadJwtRsaKeypair({
      privateKey: privatePem,
      privateKeyPath: keyPath,
    });

    expect(keypair.privateKey).toBe(filePair.privatePem.trim());
    expect(keypair.publicKey).toBe(filePair.publicPem);
  });

  it('falls back to the inline key when the configured path does not exist', () => {
    const keypair = loadJwtRsaKeypair({
      privateKey: privatePem,
      privateKeyPath: join(scratchDir, 'missing.pem'),
    });

    expect(keypair.publicKey).toBe(publicPem);
  });

  it('unescapes \\n-escaped inline PEM values', () => {
    const escaped = privatePem.trim().replace(/\n/g, '\\n');

    const keypair = loadJwtRsaKeypair({ privateKey: escaped });

    expect(keypair.privateKey).toContain('\n');
    expect(keypair.publicKey).toBe(publicPem);
  });

  it('throws a clear error when neither source is configured', () => {
    expect(() => loadJwtRsaKeypair({})).toThrow(/UMS_JWT_PRIVATE_KEY/);
  });

  it('throws when the path is set but unreadable and no inline key is given', () => {
    expect(() =>
      loadJwtRsaKeypair({ privateKeyPath: join(scratchDir, 'missing.pem') }),
    ).toThrow(/UMS_JWT_PRIVATE_KEY_PATH/);
  });

  it('rejects a non-RSA private key', () => {
    const { privateKey }: { privateKey: KeyObject } =
      generateKeyPairSync('ed25519');
    const edPem = privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();

    expect(() => loadJwtRsaKeypair({ privateKey: edPem })).toThrow(/RSA key/);
  });

  it('rejects an RSA key smaller than 2048 bits', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
    const smallPem = privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();

    expect(() => loadJwtRsaKeypair({ privateKey: smallPem })).toThrow(
      /at least 2048 bits/,
    );
  });
});
