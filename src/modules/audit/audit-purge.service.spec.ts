import { Test, TestingModule } from '@nestjs/testing';
import { AuditPurgeService } from './audit-purge.service.js';
import { AuditService } from './audit.service.js';

describe('AuditPurgeService', () => {
  let auditPurgeService: AuditPurgeService;
  let auditService: AuditService;

  const mockAuditService = {
    purge: jest.fn(() => Promise.resolve(0)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditPurgeService,
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    auditPurgeService = module.get<AuditPurgeService>(AuditPurgeService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Ensure the interval is cleared after each test
    if (auditPurgeService['purgeInterval']) {
      clearInterval(auditPurgeService['purgeInterval']);
      auditPurgeService['purgeInterval'] = null;
    }
  });

  it('should be defined', () => {
    expect(auditPurgeService).toBeDefined();
  });

  it('should call auditService.purge on module init in non-test environment', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const purgeSpy = jest.spyOn(auditService, 'purge');

    // Manually call onModuleInit to simulate the lifecycle hook
    auditPurgeService.onModuleInit();

    // Wait for the immediate purge to be called
    await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay for async purge

    expect(purgeSpy).toHaveBeenCalledTimes(1);
    expect(purgeSpy).toHaveBeenCalledWith();

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should not schedule purge in test environment', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    auditPurgeService.onModuleInit();

    expect(auditPurgeService['purgeInterval']).toBeNull();

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should clear interval on module destroy', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    auditPurgeService.onModuleInit();
    expect(auditPurgeService['purgeInterval']).not.toBeNull();

    auditPurgeService.onModuleDestroy();
    expect(auditPurgeService['purgeInterval']).toBeNull();

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should log error if purge fails', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const errorMessage = 'Purge failed';
    mockAuditService.purge.mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });
    const errorSpy = jest.spyOn(auditPurgeService['logger'], 'error');

    auditPurgeService.onModuleInit();

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(errorMessage),
      expect.any(String),
    );

    process.env.NODE_ENV = originalNodeEnv;
  });

  // Test for interval scheduling (optional, as it's time-sensitive and might make tests flaky)
  // it('should schedule periodic purge', async () => {
  //   const originalNodeEnv = process.env.NODE_ENV;
  //   process.env.NODE_ENV = 'development';

  //   jest.useFakeTimers();

  //   auditPurgeService.onModuleInit();
  //   expect(auditService.purge).toHaveBeenCalledTimes(1); // Immediate call

  //   jest.advanceTimersByTime(auditPurgeService['PURGE_INTERVAL_MS']);
  //   expect(auditService.purge).toHaveBeenCalledTimes(2);

  //   jest.advanceTimersByTime(auditPurgeService['PURGE_INTERVAL_MS']);
  //   expect(auditService.purge).toHaveBeenCalledTimes(3);

  //   jest.useRealTimers();
  //   process.env.NODE_ENV = originalNodeEnv;
  // });
});
