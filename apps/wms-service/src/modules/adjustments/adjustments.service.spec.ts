import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdjustmentsService } from './adjustments.service.js';
import { AdjustmentsRepository } from './adjustments.repository.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('AdjustmentsService', () => {
  let service: AdjustmentsService;

  const mockTx = {
    stockAdjustment: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockInventoryService = {
    recordStockMovement: jest.fn(),
  };

  const mockAdjustmentsRepository = {
    findById: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key) => {
      if (key === 'WMS_APPROVAL_THRESHOLD') return '100';
      return null;
    }),
  };

  const mockPrismaService = {
    $transaction: jest.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdjustmentsService,
        { provide: AdjustmentsRepository, useValue: mockAdjustmentsRepository },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdjustmentsService>(AdjustmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create adjustment threshold evaluation', () => {
    it('auto-approves adjustment when requestedValue <= threshold', async () => {
      const mockAdj = {
        id: 'adj-1',
        adjustmentNo: 'ADJ-001',
        status: 'APPROVED',
        warehouseId: 'wh-1',
        items: [
          {
            binId: 'bin-1',
            productId: 'prod-1',
            sku: 'SKU-001',
            batchNumber: '-',
            expiryDate: null,
            currentQuantity: 100,
            adjustedQuantity: 95,
          },
        ],
      };

      mockTx.stockAdjustment.create.mockResolvedValue(mockAdj);

      const result = await service.create({
        adjustmentNo: 'ADJ-001',
        warehouseId: 'wh-1',
        reason: 'SHRINKAGE',
        requestedValue: 50, // <= 100 threshold
        items: [
          {
            binId: 'bin-1',
            productId: 'prod-1',
            sku: 'SKU-001',
            currentQuantity: 100,
            adjustedQuantity: 95,
          },
        ],
      });

      expect(result.status).toBe('APPROVED');
      expect(mockInventoryService.recordStockMovement).toHaveBeenCalled();
    });

    it('sets status to PENDING when requestedValue > threshold', async () => {
      const mockAdj = {
        id: 'adj-2',
        adjustmentNo: 'ADJ-002',
        status: 'PENDING',
        warehouseId: 'wh-1',
        items: [],
      };

      mockTx.stockAdjustment.create.mockResolvedValue(mockAdj);

      const result = await service.create({
        adjustmentNo: 'ADJ-002',
        warehouseId: 'wh-1',
        reason: 'DAMAGE',
        requestedValue: 250, // > 100 threshold
        items: [
          {
            binId: 'bin-1',
            productId: 'prod-1',
            sku: 'SKU-001',
            currentQuantity: 100,
            adjustedQuantity: 50,
          },
        ],
      });

      expect(result.status).toBe('PENDING');
      expect(mockInventoryService.recordStockMovement).not.toHaveBeenCalled();
    });
  });
});
