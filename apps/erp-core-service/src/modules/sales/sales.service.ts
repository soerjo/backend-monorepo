import { Injectable } from '@nestjs/common';
import { SalesRepository } from './sales.repository.js';
import { PosSyncDto } from './dto/pos-sync.dto.js';
import { OrderSource, Prisma } from '@prisma/client';

interface SoItemPayload {
  productId: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

@Injectable()
export class SalesService {
  constructor(private readonly repository: SalesRepository) {}

  async ingestPosTransaction(dto: PosSyncDto) {
    // Check idempotency by POS Transaction ID
    const existing = await this.repository.findSoByExternalRef(dto.posTransactionId);
    if (existing) {
      return {
        status: 'queued',
        message: 'Transaction already ingested previously (idempotent)',
        sales_order_id: existing.id,
      };
    }

    const orderNumber = `SO-POS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const items: SoItemPayload[] = [];
    for (const item of dto.items) {
      let product = await this.repository.findProductBySku(item.sku);
      if (!product) {
        // Auto-provision product stub if not exists
        product = await this.repository.createProductStub(item.sku, item.unitPrice);
      }
      items.push({
        productId: product.id,
        qty: item.qty,
        unitPrice: item.unitPrice,
        lineTotal: Number(item.qty) * Number(item.unitPrice),
      });
    }

    const so = await this.repository.createSalesOrderWithItems({
      orderNumber,
      source: OrderSource.POS,
      externalReferenceId: dto.posTransactionId,
      customerName: `Walk-in Customer (${dto.storeCode})`,
      totalAmount: dto.totalPaid,
      items,
    });

    const outboxPayload: Prisma.InputJsonValue = {
      salesOrderId: so.id,
      orderNumber: so.orderNumber,
      posTransactionId: dto.posTransactionId,
      storeCode: dto.storeCode,
      paymentMethod: dto.paymentMethod,
      totalPaid: dto.totalPaid,
      timestamp: dto.timestamp,
      items: dto.items as unknown as Prisma.InputJsonValue,
    };

    // Queue Outbox event for Ledger Posting & WMS Inventory Adjustment
    await this.repository.createOutboxEvent(
      'SALES_ORDER',
      so.id,
      'pos.transaction.ingested',
      outboxPayload,
    );

    return {
      status: 'queued',
      message: 'Transaction ingested. Ledger entries and inventory adjustment queued.',
      sales_order_id: so.id,
    };
  }
}
