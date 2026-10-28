import { Test, TestingModule } from '@nestjs/testing';
import { SecurityPoliciesController } from './security-policies.controller';
import { SecurityPoliciesService } from './security-policies.service';
import { UpdateSecurityPolicyDto } from './dto/update-security-policies.dto';

describe('SecurityPoliciesController', () => {
  let controller: SecurityPoliciesController;

  const mockSecurityPoliciesService = {
    getPolicies: jest.fn().mockResolvedValue({
      id: 'default',
      accessTokenTtlMinutes: 15,
      refreshTokenTtlDays: 30,
      maxConcurrentSessions: 5,
      requireMfaForAdmins: true,
      enableAuditRetentionDays: 30,
      allowPasswordReset: true,
      updatedAt: new Date(),
      createdAt: new Date(),
    }),
    updatePolicies: jest.fn((dto) =>
      Promise.resolve({
        id: 'default',
        ...dto,
        updatedAt: new Date(),
        createdAt: new Date(),
      }),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityPoliciesController],
      providers: [
        {
          provide: SecurityPoliciesService,
          useValue: mockSecurityPoliciesService,
        },
      ],
    }).compile();

    controller = module.get<SecurityPoliciesController>(
      SecurityPoliciesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get security policies', async () => {
    const result = await controller.getPolicies();
    expect(result).toBeDefined();
    expect(result.accessTokenTtlMinutes).toBe(15);
    expect(mockSecurityPoliciesService.getPolicies).toHaveBeenCalled();
  });

  it('should update security policies', async () => {
    const updateDto: UpdateSecurityPolicyDto = { accessTokenTtlMinutes: 20 };
    const result = await controller.updatePolicies(updateDto);
    expect(result).toBeDefined();
    expect(result.accessTokenTtlMinutes).toBe(20);
    expect(mockSecurityPoliciesService.updatePolicies).toHaveBeenCalledWith(
      updateDto,
    );
  });
});
