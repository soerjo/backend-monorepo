import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy, UmsJwtPayload } from './jwt.strategy.js';
import { UmsJwksService } from '../auth/ums-jwks.service.js';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: UmsJwksService,
          useValue: {
            getVerificationKeys: jest.fn().mockResolvedValue({
              static: 'dummy-pem',
            }),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should validate and map UmsJwtPayload to AuthUser structure', () => {
    const payload: UmsJwtPayload = {
      sub: 'usr-123',
      email: 'finance@soerjo.internal',
      roles: ['FINANCE_MANAGER'],
      permissions: ['erp.po.approve', 'erp.journal.view'],
    };

    const user = strategy.validate(payload);
    expect(user.id).toBe('usr-123');
    expect(user.email).toBe('finance@soerjo.internal');
    expect(user.roles).toContain('FINANCE_MANAGER');
    expect(user.permissions).toContain('erp.po.approve');
  });
});
