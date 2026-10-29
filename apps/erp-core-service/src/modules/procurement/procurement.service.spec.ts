import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProcurementService } from './procurement.service.js';
import { ProcurementRepository } from './procurement.repository.js';
import { PoStatus } from '@prisma/client';
import { CreatePoDto } from './dto/create-po.dto.js';

describe('ProcurementService', () => {
  let service: ProcurementService;
  let mockRepo: {
    createVendor: jest.Mock;
    findVendorById: jest.Mock;
    findVendorByIdOrThrow: jest.Mock;
    findAllVendors: jest.Mock;
    createPurchaseOrder: jest.Mock;
    findPoById: jest.Mock;
    findPoByIdOrThrow: jest.Mock;
    updatePoStatusAndOutbox: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      createVendor: jest.fn(),
      findVendorById: jest.fn(),
      findVendorByIdOrThrow: jest.fn(),
      findAllVendors: jest.fn(),
      createPurchaseOrder: jest.fn(),
      findPoById: jest.fn(),
      findPoByIdOrThrow: jest.fn(),
      updatePoStatusAndOutbox: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementService,
        {
          provide: ProcurementRepository,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
  });

  it('should calculate 11% PPN tax and total amount when creating PO', async () => {
    mockRepo.findVendorByIdOrThrow.mockResolvedValue({
      id: 'vend-1',
      name: 'Vendor 1',
    });
    mockRepo.createPurchaseOrder.mockImplementation(
      (data: { taxAmount: number; totalAmount: number }) =>
        Promise.resolve({
          id: 'po-1',
          ...data,
          status: PoStatus.DRAFT,
        }),
    );

    const dto: CreatePoDto = {
      vendorId: 'vend-1',
      items: [
        { productId: 'prod-1', qtyOrdered: 100, unitPrice: 50000 }, // 5,000,000
      ],
    };

    const created = await service.createPo(dto, 'user-uuid');
    expect(created.id).toBe('po-1');
    expect(mockRepo.createPurchaseOrder).toHaveBeenCalledTimes(1);

    const callArgs = mockRepo.createPurchaseOrder.mock.calls[0] as [
      { taxAmount: number; totalAmount: number },
    ];
    expect(callArgs[0].taxAmount).toBe(550000);
    expect(callArgs[0].totalAmount).toBe(5550000);
  });

  it('should transition PO status to APPROVED and queue ASN to Outbox', async () => {
    mockRepo.findPoByIdOrThrow.mockResolvedValue({
      id: 'po-1',
      poNumber: 'PO-202610-0001',
      vendorId: 'vend-1',
      status: PoStatus.DRAFT,
      expectedDeliveryDate: new Date('2026-11-15'),
      items: [{ productId: 'prod-1', qtyOrdered: 100 }],
    });

    mockRepo.updatePoStatusAndOutbox.mockResolvedValue({
      id: 'po-1',
      status: PoStatus.APPROVED,
    });

    const res = await service.approvePo('po-1', 'approver-uuid');
    expect(res.status).toBe(PoStatus.APPROVED);
    expect(mockRepo.updatePoStatusAndOutbox).toHaveBeenCalledTimes(1);
  });

  it('should throw BadRequestException if approving an already APPROVED PO', async () => {
    mockRepo.findPoByIdOrThrow.mockResolvedValue({
      id: 'po-1',
      status: PoStatus.APPROVED,
      items: [],
    });

    await expect(service.approvePo('po-1', 'approver-uuid')).rejects.toThrow(BadRequestException);
  });
});
