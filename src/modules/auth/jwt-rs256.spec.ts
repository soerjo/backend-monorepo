import { generateKeyPairSync } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { loadJwtRsaKeypair } from '../../common/utils/jwt-keypair.util.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

interface DecodedHeader {
  alg: string;
}

describe('RS256 access token signing (CMS contract)', () => {
  const authUser: AuthUser = {
    id: '11111111-2222-3333-4444-555555555555',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'ADMIN',
    organizationId: 'org-1',
  };

  // Keys are generated at runtime inside the test - never committed.
  let privatePem: string;
  let keypair: { privateKey: string; publicKey: string };
  let service: AuthService;
  let accessTokenService: JwtService;
  let accessTokenVerifier: JwtService;

  beforeEach(() => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    keypair = loadJwtRsaKeypair({ privateKey: privatePem });

    accessTokenService = new JwtService({
      privateKey: keypair.privateKey,
      signOptions: { algorithm: 'RS256', expiresIn: 900 },
    });
    accessTokenVerifier = new JwtService({ publicKey: keypair.publicKey });

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        return undefined;
      }),
    };

    service = new AuthService(
      {} as unknown as UsersRepository,
      accessTokenService,
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

  it('signs the access token with RS256 using the configured keypair', () => {
    const { accessToken } = service.login(authUser);

    expect(decodeHeader(accessToken).alg).toBe('RS256');
  });

  it('verifies the access token against the derived public key with sub + email claims', () => {
    const { accessToken } = service.login(authUser);

    const decoded = accessTokenVerifier.verify<{
      sub: string;
      email: string;
      id: string;
    }>(accessToken, { algorithms: ['RS256'] });

    expect(decoded.sub).toBe(authUser.id);
    expect(decoded.email).toBe(authUser.email);
    expect(decoded.id).toBe(authUser.id);
  });

  it('keeps the refresh token on HS256 with the refresh secret', () => {
    const { refreshToken } = service.login(authUser);

    const refreshVerifier = new JwtService({ secret: 'test-refresh-secret' });
    const decoded = refreshVerifier.verify<{ sub: string; email: string }>(
      refreshToken,
      { algorithms: ['HS256'] },
    );

    expect(decodeHeader(refreshToken).alg).toBe('HS256');
    expect(decoded.sub).toBe(authUser.id);
    expect(decoded.email).toBe(authUser.email);
  });

  it('rejects a forged HS256 token when verifying with the RS256 public key', () => {
    const forged = new JwtService({
      secret: 'attacker-controlled-secret',
      signOptions: { algorithm: 'HS256', expiresIn: 900 },
    }).sign({ sub: authUser.id, email: 'attacker@example.com' });

    expect(() =>
      accessTokenVerifier.verify<Record<string, unknown>>(forged, {
        algorithms: ['RS256'],
      }),
    ).toThrow();
  });
});
