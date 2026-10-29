import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service.js';
import { SalesRepository } from './sales.repository.js';
import { PosSyncDto } from './dto/pos-sync.dto.js';
import { OrderSource, SoStatus } from '@prisma/client';

describe('SalesService', () => {
  let service: SalesService;
  let mockRepo: {
    findProductBySku: jest.Mock;
    findSoByExternalRef: jest.Mock;
    createSalesOrderWithItems: jest.Mock;
    createOutboxEvent: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      findProductBySku: jest.fn(),
      findSoByExternalRef: jest.fn(),
      createSalesOrderWithItems: jest.fn(),
      createOutboxEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: SalesRepository,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  it('should return idempotent status if posTransactionId was already ingested', async () => {
    mockRepo.findSoByExternalRef.mockResolvedValue({
      id: 'so-existing-1',
      orderNumber: 'SO-001',
    });

    const dto: PosSyncDto = {
      posTransactionId: 'POS-JKT01-99882',
      storeCode: 'STORE-KUNINGAN',
      timestamp: '2026-10-29T10:30:00Z',
      totalPaid: 150000,
      paymentMethod: 'CASH',
      items: [{ sku: 'SKU-BEV-001', qty: 3, unitPrice: 50000 }],
    };

    const res = await service.ingestPosTransaction(dto);
    expect(res.status).toBe('queued');
    expect(res.sales_order_id).toBe('so-existing-1');
    expect(res.message).toContain('idempotent');
    expect(mockRepo.createSalesOrderWithItems).not.toHaveBeenCalled();
  });

  it('should ingest new POS transaction, create Sales Order, and queue outbox event', async () => {
    mockRepo.findSoByExternalRef.mockResolvedValue(null);
    mockRepo.findProductBySku.mockResolvedValue({
      id: 'prod-sku-1',
      sku: 'SKU-BEV-001',
    });

    mockRepo.createSalesOrderWithItems.mockResolvedValue({
      id: 'so-new-1',
      orderNumber: 'SO-POS-999',
      source: OrderSource.POS,
      totalAmount: 150000,
      status: SoStatus.PENDING,
    });

    const dto: PosSyncDto = {
      posTransactionId: 'POS-JKT01-99882',
      storeCode: 'STORE-KUNINGAN',
      timestamp: '2026-10-29T10:30:00Z',
      totalPaid: 150000,
      paymentMethod: 'CASH',
      items: [{ sku: 'SKU-BEV-001', qty: 3, unitPrice: 50000 }],
    };

    const res = await service.ingestPosTransaction(dto);
    expect(res.status).toBe('queued');
    expect(res.sales_order_id).toBe('so-new-1');
    expect(mockRepo.createSalesOrderWithItems).toHaveBeenCalledTimes(1);
    expect(mockRepo.createOutboxEvent).toHaveBeenCalledTimes(1);
  });
});
