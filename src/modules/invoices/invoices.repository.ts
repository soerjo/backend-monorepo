import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  InvoiceStatus,
  PaymentChannel,
  PaymentProvider,
  Prisma,
} from '@prisma/client';

@Injectable()
export class InvoicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateBillingAccount(
    organizationId: string,
    name?: string,
    email?: string,
  ) {
    return this.prisma.billingAccount.upsert({
      where: { organizationId },
      update: {},
      create: {
        organizationId,
        name: name || `Org ${organizationId.slice(0, 8)}`,
        email: email || `billing@org-${organizationId.slice(0, 8)}.local`,
      },
    });
  }

  async countInvoicesToday(startOfDay: Date, endOfDay: Date) {
    return this.prisma.invoice.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });
  }

  async create(data: Prisma.InvoiceUncheckedCreateInput) {
    return this.prisma.invoice.create({
      data,
      include: {
        transactions: true,
        billingAccount: true,
      },
    });
  }

  async findById(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
        billingAccount: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID '${id}' not found`);
    }

    return invoice;
  }

  async findByInvoiceNumber(invoiceNumber: string) {
    return this.prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: {
        transactions: true,
        billingAccount: true,
      },
    });
  }

  async createTransaction(data: {
    invoiceId: string;
    midtransOrderId: string;
    grossAmount: number | Prisma.Decimal;
    provider?: PaymentProvider;
    channel?: PaymentChannel;
    snapToken?: string;
    snapRedirectUrl?: string;
    status?: string;
    requestPayload?: Prisma.InputJsonValue;
    rawResponse?: Prisma.InputJsonValue;
  }) {
    return this.prisma.paymentTransaction.create({
      data: {
        invoiceId: data.invoiceId,
        midtransOrderId: data.midtransOrderId,
        grossAmount: data.grossAmount,
        provider: data.provider || PaymentProvider.MIDTRANS,
        channel: data.channel || PaymentChannel.SNAP_ALL,
        snapToken: data.snapToken,
        snapRedirectUrl: data.snapRedirectUrl,
        status: data.status || 'PENDING',
        requestPayload: data.requestPayload,
        rawResponse: data.rawResponse,
      },
    });
  }

  async updateInvoiceStatus(
    id: string,
    status: InvoiceStatus,
    paidAt?: Date,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.invoice.update({
      where: { id },
      data: {
        status,
        paidAt:
          paidAt || (status === InvoiceStatus.PAID ? new Date() : undefined),
      },
    });
  }
}
