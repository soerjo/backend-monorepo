import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IntegrationService } from './integration.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { WmsGoodsReceivedDto } from './dto/wms-receipt.dto.js';
import { PoStatus } from '@prisma/client';

describe('IntegrationService', () => {
  let service: IntegrationService;
  let prismaMock: {
    purchaseOrder: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      purchaseOrder: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<IntegrationService>(IntegrationService);
  });

  it('should throw NotFoundException if PO does not exist on WMS receipt callback', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue(null);

    const dto: WmsGoodsReceivedDto = {
      poNumber: 'PO-NONEXISTENT',
      wmsReceiptId: 'GRN-001',
      receivedItems: [{ sku: 'SKU-001', qtyReceived: 10 }],
    };

    await expect(service.handleWmsGoodsReceived(dto)).rejects.toThrow(NotFoundException);
  });

  it('should reconcile goods receipt and return posted journal_entry_id', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: 'po-1',
      poNumber: 'PO-202610-0001',
      createdBy: 'user-uuid',
      status: PoStatus.APPROVED,
      vendorId: 'vend-1',
      items: [
        {
          id: 'item-1',
          unitPrice: 50000,
          product: { sku: 'SKU-BEV-001' },
        },
      ],
    });

    prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        purchaseOrderItem: { update: jest.fn().mockResolvedValue({}) },
        chartOfAccount: {
          findUnique: jest.fn().mockResolvedValue({ id: 'acc-1' }),
          create: jest.fn().mockResolvedValue({ id: 'acc-1' }),
        },
        journalEntry: {
          create: jest.fn().mockResolvedValue({
            id: 'bb029671-5544-482f-8705-cb6684aa5699',
          }),
        },
        purchaseOrder: { update: jest.fn().mockResolvedValue({}) },
        outboxEvent: { create: jest.fn().mockResolvedValue({}) },
      };
      return cb(txMock);
    });

    const dto: WmsGoodsReceivedDto = {
      poNumber: 'PO-202610-0001',
      wmsReceiptId: 'GRN-2026-0091',
      receivedItems: [{ sku: 'SKU-BEV-001', qtyReceived: 100 }],
    };

    const result = await service.handleWmsGoodsReceived(dto);
    expect(result.status).toBe('success');
    expect(result.journal_entry_id).toBe('bb029671-5544-482f-8705-cb6684aa5699');
  });
});
