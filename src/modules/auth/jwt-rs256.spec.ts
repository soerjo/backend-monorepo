import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { loadJwtRsaKeypair } from '../../common/utils/jwt-keypair.util.js';
import { computeKeyId } from '../../common/utils/jwk.util.js';
import { JWT_AZP, JWT_ISSUER } from './auth.constants.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

interface DecodedHeader {
  alg: string;
  kid?: string;
}

describe('RS256 access token signing (UMS contract)', () => {
  const authUser: AuthUser = {
    id: '11111111-2222-3333-4444-555555555555',
    email: 'ada@example.com',
    name: 'Ada Lovelace',
    roles: ['ums:admin'],
    orgs: ['pesanggrahan'],
    perms: ['users:read'],
  };

  let keypair: { privateKey: string; publicKey: string };
  let service: AuthService;
  let verifier: JwtService;

  beforeEach(() => {
    const { privateKey }: { privateKey: KeyObject } = generateKeyPairSync(
      'rsa',
      { modulusLength: 2048 },
    );
    const privatePem = privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();

    keypair = loadJwtRsaKeypair({ privateKey: privatePem });

    const signer = new JwtService({
      privateKey: keypair.privateKey,
      signOptions: {
        algorithm: 'RS256',
        expiresIn: 900,
        issuer: JWT_ISSUER,
        keyid: computeKeyId(keypair.publicKey),
      },
    });
    verifier = new JwtService({ publicKey: keypair.publicKey });

    const configService = {
      get: jest.fn(() => undefined),
    };

    service = new AuthService(
      {} as unknown as UsersRepository,
      signer,
      configService as unknown as ConfigService,
      {} as unknown as PrismaService,
    );
  });

  function decodeHeader(token: string): DecodedHeader {
    const [encodedHeader] = token.split('.');
    return JSON.parse(
      Buffer.from(encodedHeader, 'base64url').toString('utf8'),
    ) as DecodedHeader;
  }

  it('signs the access token with RS256 and a matching kid', () => {
    const token = service.buildAccessToken(authUser);

    const header = decodeHeader(token);
    expect(header.alg).toBe('RS256');
    expect(header.kid).toBe(computeKeyId(keypair.publicKey));
  });

  it('carries the UMS claims (sub, email, roles, orgs, iss, azp)', () => {
    const token = service.buildAccessToken(authUser);

    const decoded = verifier.verify<{
      sub: string;
      email: string;
      name: string;
      roles: string[];
      orgs: string[];
      iss: string;
      azp: string;
    }>(token, { algorithms: ['RS256'] });

    expect(decoded.sub).toBe(authUser.id);
    expect(decoded.email).toBe(authUser.email);
    expect(decoded.name).toBe(authUser.name);
    expect(decoded.roles).toEqual(['ums:admin']);
    expect(decoded.orgs).toEqual(['pesanggrahan']);
    expect(decoded.iss).toBe(JWT_ISSUER);
    expect(decoded.azp).toBe(JWT_AZP);
  });

  it('rejects a forged HS256 token when verifying with the RS256 public key', () => {
    const forged = new JwtService({
      secret: 'attacker-controlled-secret',
      signOptions: { algorithm: 'HS256', expiresIn: 900 },
    }).sign({ sub: authUser.id, email: 'attacker@example.com' });

    expect(() =>
      verifier.verify<Record<string, unknown>>(forged, {
        algorithms: ['RS256'],
      }),
    ).toThrow();
  });
});
