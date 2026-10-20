import { Test, type TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MidtransService } from '../midtrans/midtrans.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { BadRequestException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';

describe('WebhooksService', () => {
  let service: WebhooksService;

  const mockTx = {
    webhookEvent: {
      create: jest.fn(),
    },
    paymentTransaction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      update: jest.fn(),
    },
  };

  const mockPrisma = {
    webhookEvent: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  };

  const mockMidtransService = {
    verifySignatureKey: jest.fn(),
  };

  const mockOutboxService = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MidtransService, useValue: mockMidtransService },
        { provide: OutboxService, useValue: mockOutboxService },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  const validPayload = {
    order_id: 'INV-20261020-0001-TX1',
    status_code: '200',
    gross_amount: '150000.00',
    signature_key: 'valid-signature-sha512',
    transaction_id: 'midtrans-tx-999',
    transaction_status: 'settlement',
    fraud_status: 'accept',
  };

  it('throws BadRequestException if signature is invalid', async () => {
    mockMidtransService.verifySignatureKey.mockReturnValue(false);

    await expect(service.handleMidtransWebhook(validPayload)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('skips processing if eventId was already processed (idempotency)', async () => {
    mockMidtransService.verifySignatureKey.mockReturnValue(true);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      id: 'existing-event',
    });

    const result = await service.handleMidtransWebhook(validPayload);
    expect(result.status).toBe('ALREADY_PROCESSED');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('processes settlement payment, marks invoice as PAID and emits outbox event', async () => {
    mockMidtransService.verifySignatureKey.mockReturnValue(true);
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);

    const mockInvoice = {
      id: 'inv-1',
      invoiceNumber: 'INV-20261020-0001',
      amount: new Prisma.Decimal(150000),
      status: InvoiceStatus.UNPAID,
      billingAccount: { organizationId: 'org-1' },
    };

    mockTx.paymentTransaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      midtransOrderId: 'INV-20261020-0001-TX1',
      invoice: mockInvoice,
    });

    const result = await service.handleMidtransWebhook(validPayload);

    expect(result.status).toBe('PROCESSED');
    expect(mockTx.webhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'midtrans-tx-999',
        orderId: 'INV-20261020-0001-TX1',
      }) as unknown,
    });
    expect(mockTx.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: expect.objectContaining({ status: InvoiceStatus.PAID }) as unknown,
    });
    expect(mockOutboxService.emit).toHaveBeenCalledWith(
      'INVOICE',
      'inv-1',
      'INVOICE_PAID',
      expect.objectContaining({
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-20261020-0001',
        organizationId: 'org-1',
        amount: 150000,
      }),
      mockTx,
    );
  });
});
