import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MidtransService } from '../payments/midtrans.service.js';
import { CheckoutDto } from './dto/checkout.dto.js';
import { InvoiceStatus, PaymentChannel, PaymentProvider, Prisma } from '@prisma/client';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly midtransService: MidtransService,
  ) {}

  async createCheckoutSession(invoiceId: string, dto: CheckoutDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException(`Invoice ${invoice.invoiceNumber} is already paid`);
    }

    const txSeq = (await this.prisma.paymentTransaction.count({ where: { invoiceId } })) + 1;
    const midtransOrderId = `${invoice.invoiceNumber}-TX${txSeq}`;
    const grossAmount = Number(invoice.amount);

    const midtransRes = await this.midtransService.charge(
      midtransOrderId,
      grossAmount,
      'MIDTRANS_QRIS',
    );

    const token = typeof midtransRes === 'object' && midtransRes !== null && 'token' in midtransRes
      ? String((midtransRes as Record<string, unknown>).token)
      : `snap-token-${midtransOrderId}`;

    const redirectUrl = typeof midtransRes === 'object' && midtransRes !== null && 'redirect_url' in midtransRes
      ? String((midtransRes as Record<string, unknown>).redirect_url)
      : `https://app.sandbox.midtrans.com/snap/v2/vtweb/${token}`;

    const tx = await this.prisma.paymentTransaction.create({
      data: {
        invoiceId,
        provider: PaymentProvider.MIDTRANS,
        channel: dto.channel || PaymentChannel.SNAP_ALL,
        grossAmount: new Prisma.Decimal(grossAmount),
        status: 'PENDING',
        midtransOrderId,
        snapToken: token,
        snapRedirectUrl: redirectUrl,
        rawResponse: (midtransRes as Prisma.InputJsonValue) || Prisma.JsonNull,
      },
    });

    return {
      transactionId: tx.id,
      midtransOrderId,
      grossAmount,
      snapToken: token,
      snapRedirectUrl: redirectUrl,
    };
  }
}
