import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UmsJwksService } from './ums-jwks.service.js';
import { generateKeyPairSync } from 'node:crypto';

describe('UmsJwksService', () => {
  let service: UmsJwksService;
  let publicKeyPem: string;

  beforeAll(() => {
    const { publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });
    publicKeyPem = publicKey;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UmsJwksService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'UMS_JWT_PUBLIC_KEY') return publicKeyPem;
              if (key === 'UMS_JWKS_URL') return null;
              if (key === 'UMS_JWKS_CACHE_TTL_SECONDS') return 3600;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<UmsJwksService>(UmsJwksService);
  });

  it('should fallback to static public key when jwksUrl is null', async () => {
    const keys = await service.getVerificationKeys();
    expect(keys.static).toBeDefined();
    expect(keys.static).toContain('BEGIN PUBLIC KEY');

    const keyObj = await service.getPublicKey();
    expect(keyObj).toBeDefined();
  });
});
