import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InboundService } from './inbound.service.js';
import { InboundRepository } from './inbound.repository.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('InboundService', () => {
  let service: InboundService;

  const mockTx = {
    inboundShipment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    inboundShipmentItem: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    storageBin: {
      findUnique: jest.fn(),
    },
  };

  const mockInventoryService = {
    recordStockMovement: jest.fn(),
  };

  const mockInboundRepository = {};

  const mockPrismaService = {
    $transaction: jest.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboundService,
        { provide: InboundRepository, useValue: mockInboundRepository },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<InboundService>(InboundService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createReceipt', () => {
    it('creates shipment and records stock movement for each item', async () => {
      const mockShipment = {
        id: 'ship-1',
        shipmentNo: 'PO-001',
        warehouseId: 'wh-1',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            sku: 'SKU-001',
            batchNumber: 'B-1',
            expiryDate: null,
            quantity: 100,
          },
        ],
      };

      mockTx.inboundShipment.create.mockResolvedValue(mockShipment);
      mockTx.inboundShipmentItem.update.mockResolvedValue({});
      mockTx.inboundShipment.update.mockResolvedValue({
        ...mockShipment,
        status: 'COMPLETED',
      });

      const result = await service.createReceipt({
        shipmentNo: 'PO-001',
        warehouseId: 'wh-1',
        receivingBinId: 'bin-rec',
        items: [
          {
            productId: 'prod-1',
            sku: 'SKU-001',
            quantity: 100,
          },
        ],
      });

      expect(result.status).toBe('COMPLETED');
      expect(mockInventoryService.recordStockMovement).toHaveBeenCalledTimes(1);
    });
  });

  describe('putaway', () => {
    it('throws NotFoundException if target bin does not exist', async () => {
      mockTx.storageBin.findUnique.mockResolvedValue(null);

      await expect(
        service.putaway({
          shipmentId: 'ship-1',
          itemId: 'item-1',
          sourceBinId: 'bin-rec',
          targetBinId: 'bin-target',
          quantity: 50,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if target bin is not ACTIVE', async () => {
      mockTx.storageBin.findUnique.mockResolvedValue({
        id: 'bin-target',
        binCode: 'A-01',
        status: 'QUARANTINE',
      });

      await expect(
        service.putaway({
          shipmentId: 'ship-1',
          itemId: 'item-1',
          sourceBinId: 'bin-rec',
          targetBinId: 'bin-target',
          quantity: 50,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully executes putaway when target bin is ACTIVE', async () => {
      mockTx.storageBin.findUnique.mockResolvedValue({
        id: 'bin-target',
        binCode: 'A-01',
        status: 'ACTIVE',
      });
      mockTx.inboundShipmentItem.findUnique.mockResolvedValue({
        id: 'item-1',
        productId: 'prod-1',
        sku: 'SKU-001',
        batchNumber: '-',
        expiryDate: null,
      });
      mockTx.inboundShipment.findUnique.mockResolvedValue({
        id: 'ship-1',
        warehouseId: 'wh-1',
      });

      const res = await service.putaway({
        shipmentId: 'ship-1',
        itemId: 'item-1',
        sourceBinId: 'bin-rec',
        targetBinId: 'bin-target',
        quantity: 50,
      });

      expect(res.success).toBe(true);
      expect(mockInventoryService.recordStockMovement).toHaveBeenCalledTimes(2);
    });
  });
});
