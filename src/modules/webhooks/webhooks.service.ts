import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MidtransService } from '../midtrans/midtrans.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { InvoiceStatus, Prisma } from '@prisma/client';

export interface MidtransWebhookPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_id: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
  settlement_time?: string;
  [key: string]: unknown;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly midtransService: MidtransService,
    private readonly outboxService: OutboxService,
  ) {}

  async handleMidtransWebhook(payload: MidtransWebhookPayload) {
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_id,
      transaction_status,
      fraud_status,
    } = payload;

    // 1. Signature validation
    const isValidSignature = this.midtransService.verifySignatureKey({
      orderId: order_id,
      statusCode: status_code,
      grossAmount: gross_amount,
      signatureKey: signature_key,
    });

    if (!isValidSignature) {
      this.logger.warn(`Invalid signature for order ${order_id}`);
      throw new BadRequestException('Invalid signature key');
    }

    // 2. Idempotency check via WebhookEvent
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { eventId: transaction_id },
    });

    if (existingEvent) {
      this.logger.log(
        `Webhook event ${transaction_id} for order ${order_id} already processed. Skipping.`,
      );
      return { status: 'ALREADY_PROCESSED', eventId: transaction_id };
    }

    return this.prisma.$transaction(async (tx) => {
      // Record webhook event for idempotency
      await tx.webhookEvent.create({
        data: {
          provider: 'MIDTRANS',
          eventId: transaction_id,
          orderId: order_id,
          signatureKey: signature_key,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });

      // Find transaction
      const transaction = await tx.paymentTransaction.findUnique({
        where: { midtransOrderId: order_id },
        include: {
          invoice: {
            include: { billingAccount: true },
          },
        },
      });

      if (!transaction) {
        this.logger.warn(`No payment transaction found for order ${order_id}`);
        return { status: 'TRANSACTION_NOT_FOUND', orderId: order_id };
      }

      const normalizedStatus = transaction_status.toUpperCase();

      // Update transaction status
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: normalizedStatus,
          midtransTransactionId: transaction_id,
          rawResponse: payload as unknown as Prisma.InputJsonValue,
        },
      });

      // Check if payment is successful
      const isPaid =
        transaction_status === 'settlement' ||
        (transaction_status === 'capture' && fraud_status === 'accept');

      if (isPaid && transaction.invoice.status !== InvoiceStatus.PAID) {
        const paidAt = payload.settlement_time
          ? new Date(payload.settlement_time)
          : new Date();

        await tx.invoice.update({
          where: { id: transaction.invoice.id },
          data: {
            status: InvoiceStatus.PAID,
            paidAt,
          },
        });

        // Emit outbox event for Kafka publishing
        await this.outboxService.emit(
          'INVOICE',
          transaction.invoice.id,
          'INVOICE_PAID',
          {
            eventId: transaction_id,
            eventType: 'INVOICE_PAID',
            invoiceId: transaction.invoice.id,
            invoiceNumber: transaction.invoice.invoiceNumber,
            organizationId: transaction.invoice.billingAccount.organizationId,
            amount: Number(transaction.invoice.amount),
            paidAt: paidAt.toISOString(),
            metadata: transaction.invoice.metadata,
          },
          tx,
        );

        this.logger.log(
          `Invoice ${transaction.invoice.invoiceNumber} marked as PAID via Midtrans webhook`,
        );
      }

      return { status: 'PROCESSED', eventId: transaction_id };
    });
  }
}
