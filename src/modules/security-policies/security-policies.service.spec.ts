import { Test, TestingModule } from '@nestjs/testing';
import { SecurityPoliciesService } from './security-policies.service.js';
import { SecurityPoliciesRepository } from './security-policies.repository.js';

describe('SecurityPoliciesService', () => {
  let service: SecurityPoliciesService;
  const mockRepository = {
    getPolicies: jest.fn().mockResolvedValue({
      accessTokenTtlMinutes: 15,
      refreshTokenTtlDays: 30,
      maxConcurrentSessions: 5,
      requireMfaForAdmins: true,
      enableAuditRetentionDays: 30,
      allowPasswordReset: true,
    }),
    updatePolicies: jest.fn().mockImplementation((dto) =>
      Promise.resolve({
        accessTokenTtlMinutes: 20,
        refreshTokenTtlDays: 30,
        maxConcurrentSessions: 5,
        requireMfaForAdmins: true,
        enableAuditRetentionDays: 30,
        allowPasswordReset: true,
        ...dto,
      }),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityPoliciesService,
        { provide: SecurityPoliciesRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<SecurityPoliciesService>(SecurityPoliciesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get policies', async () => {
    const policies = await service.getPolicies();
    expect(policies).toBeDefined();
    expect(policies.accessTokenTtlMinutes).toBe(15);
    expect(mockRepository.getPolicies).toHaveBeenCalled();
  });

  it('should update policies', async () => {
    const updateDto = { accessTokenTtlMinutes: 20 };
    const updatedPolicies = await service.updatePolicies(updateDto);
    expect(updatedPolicies.accessTokenTtlMinutes).toBe(20);
    expect(mockRepository.updatePolicies).toHaveBeenCalledWith(updateDto);
  });
});
