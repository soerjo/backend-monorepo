import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TransfersService } from './transfers.service.js';
import { TransfersRepository } from './transfers.repository.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('TransfersService', () => {
  let service: TransfersService;
  let transfersRepository: TransfersRepository;

  const mockTx = {
    stockTransfer: {
      update: jest.fn(),
    },
    storageBin: {
      findUnique: jest.fn(),
    },
  };

  const mockInventoryService = {
    allocateStock: jest.fn(),
    recordStockMovement: jest.fn(),
  };

  const mockTransfersRepository = {
    findById: jest.fn(),
  };

  const mockPrismaService = {
    $transaction: jest.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: TransfersRepository, useValue: mockTransfersRepository },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
    transfersRepository = module.get<TransfersRepository>(TransfersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('dispatch', () => {
    it('throws BadRequestException if transfer is not in DRAFT status', async () => {
      jest.spyOn(transfersRepository, 'findById').mockResolvedValue({
        id: 'tr-1',
        transferNo: 'TR-001',
        status: 'IN_TRANSIT',
      } as unknown as Awaited<ReturnType<TransfersRepository['findById']>>);

      await expect(service.dispatch('tr-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allocates and deducts stock from origin warehouse when dispatching', async () => {
      jest.spyOn(transfersRepository, 'findById').mockResolvedValue({
        id: 'tr-1',
        transferNo: 'TR-001',
        status: 'DRAFT',
        originWarehouseId: 'wh-1',
        items: [
          {
            productId: 'prod-1',
            sku: 'SKU-001',
            batchNumber: 'B-1',
            quantity: 20,
          },
        ],
      } as unknown as Awaited<ReturnType<TransfersRepository['findById']>>);

      mockInventoryService.allocateStock.mockResolvedValue([
        {
          binId: 'bin-orig',
          productId: 'prod-1',
          sku: 'SKU-001',
          batchNumber: 'B-1',
          expiryDate: null,
          quantityToDeduct: 20,
        },
      ]);

      mockTx.stockTransfer.update.mockResolvedValue({
        id: 'tr-1',
        status: 'IN_TRANSIT',
      });

      const res = await service.dispatch('tr-1');
      expect(res.status).toBe('IN_TRANSIT');
      expect(mockInventoryService.allocateStock).toHaveBeenCalled();
      expect(mockInventoryService.recordStockMovement).toHaveBeenCalled();
    });
  });
});
