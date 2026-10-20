import { Test, type TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service.js';
import { InvoicesRepository } from './invoices.repository.js';
import { MidtransService } from '../midtrans/midtrans.service.js';
import { InvoiceStatus, Prisma } from '@prisma/client';

describe('InvoicesService', () => {
  let service: InvoicesService;

  const mockRepository = {
    findOrCreateBillingAccount: jest.fn(),
    countInvoicesToday: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    createTransaction: jest.fn(),
  };

  const mockMidtransService = {
    createSnapTransaction: jest.fn(),
  };

  const mockBillingAccount = {
    id: 'ba-1',
    organizationId: 'org-1',
    name: 'Toko Kopi',
    email: 'kopi@toko.local',
  };

  const mockInvoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-20261020-0001',
    billingAccountId: 'ba-1',
    amount: new Prisma.Decimal(150000),
    status: InvoiceStatus.UNPAID,
    dueDate: new Date(),
    billingAccount: mockBillingAccount,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: InvoicesRepository, useValue: mockRepository },
        { provide: MidtransService, useValue: mockMidtransService },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('creates an invoice with formatted invoice number', async () => {
    mockRepository.findOrCreateBillingAccount.mockResolvedValue(
      mockBillingAccount,
    );
    mockRepository.countInvoicesToday.mockResolvedValue(0);
    mockRepository.create.mockResolvedValue(mockInvoice);

    const result = await service.createInvoice({
      organizationId: 'org-1',
      amount: 150000,
      dueDate: new Date().toISOString(),
      description: 'Monthly SaaS',
    });

    expect(result).toEqual(mockInvoice);
    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        billingAccountId: 'ba-1',
        amount: new Prisma.Decimal(150000),
        status: InvoiceStatus.UNPAID,
        invoiceNumber: expect.stringMatching(/^INV-\d{8}-0001$/) as unknown,
      }),
    );
  });

  it('checkouts an invoice by generating a Midtrans Snap transaction', async () => {
    mockRepository.findById.mockResolvedValue(mockInvoice);
    mockMidtransService.createSnapTransaction.mockResolvedValue({
      token: 'snap-token-xyz',
      redirect_url: 'https://midtrans.com/pay',
    });
    mockRepository.createTransaction.mockResolvedValue({
      id: 'tx-1',
    });

    const result = await service.checkoutInvoice('inv-1', {});

    expect(result.snapToken).toBe('snap-token-xyz');
    expect(result.grossAmount).toBe(150000);
    expect(mockRepository.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 'inv-1',
        snapToken: 'snap-token-xyz',
        status: 'PENDING',
      }),
    );
  });
});
