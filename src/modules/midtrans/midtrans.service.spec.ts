import { Test, type TestingModule } from '@nestjs/testing';
import { MidtransService } from './midtrans.service.js';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

describe('MidtransService', () => {
  let service: MidtransService;

  const serverKey = 'SB-Mid-server-testkey12345';

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => {
      if (key === 'MIDTRANS_SERVER_KEY') return serverKey;
      if (key === 'MIDTRANS_IS_PRODUCTION') return false;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MidtransService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MidtransService>(MidtransService);
  });

  describe('verifySignatureKey', () => {
    it('returns true when SHA512 matches orderId + statusCode + grossAmount + serverKey', () => {
      const orderId = 'INV-20261020-0001-TX1';
      const statusCode = '200';
      const grossAmount = '150000.00';
      const validSignature = createHash('sha512')
        .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
        .digest('hex');

      const isValid = service.verifySignatureKey({
        orderId,
        statusCode,
        grossAmount,
        signatureKey: validSignature,
      });

      expect(isValid).toBe(true);
    });

    it('returns false when signature does not match', () => {
      const isValid = service.verifySignatureKey({
        orderId: 'INV-20261020-0001-TX1',
        statusCode: '200',
        grossAmount: '150000.00',
        signatureKey: 'tampered-signature-invalid',
      });

      expect(isValid).toBe(false);
    });
  });
});
