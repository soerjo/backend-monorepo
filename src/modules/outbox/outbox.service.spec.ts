import { Test, type TestingModule } from '@nestjs/testing';
import { OutboxService } from './outbox.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

describe('OutboxService', () => {
  let service: OutboxService;

  const mockPrisma = {
    outboxEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => defaultValue),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
  });

  it('emits an outbox event to database', async () => {
    mockPrisma.outboxEvent.create.mockResolvedValue({ id: 'outbox-1' });

    const result = await service.emit('INVOICE', 'inv-1', 'INVOICE_PAID', {
      amount: 150000,
    });

    expect(result).toEqual({ id: 'outbox-1' });
    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateType: 'INVOICE',
        aggregateId: 'inv-1',
        eventType: 'INVOICE_PAID',
        status: 'PENDING',
      }) as unknown,
    });
  });

  it('processes pending events via fallback when kafka is not connected', async () => {
    mockPrisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'outbox-1',
        aggregateType: 'INVOICE',
        aggregateId: 'inv-1',
        eventType: 'INVOICE_PAID',
        payload: { amount: 150000 },
      },
    ]);
    mockPrisma.outboxEvent.update.mockResolvedValue({ id: 'outbox-1' });

    const processed = await service.processPendingEvents();

    expect(processed).toBe(1);
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'outbox-1' },
      data: expect.objectContaining({ status: 'PROCESSED' }) as unknown,
    });
  });
});
