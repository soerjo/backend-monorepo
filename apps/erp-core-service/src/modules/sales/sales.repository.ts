import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrderSource, Prisma, Product, SalesOrder, SoStatus } from '@prisma/client';

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findProductBySku(sku: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { sku },
    });
  }

  async createProductStub(sku: string, unitPrice: number): Promise<Product> {
    return this.prisma.product.create({
      data: {
        sku,
        name: `POS Product ${sku}`,
        uom: 'PCS',
        sellingPrice: unitPrice,
      },
    });
  }

  async findSoByExternalRef(externalReferenceId: string): Promise<SalesOrder | null> {
    return this.prisma.salesOrder.findFirst({
      where: { externalReferenceId },
    });
  }

  async createSalesOrderWithItems(data: {
    orderNumber: string;
    source: OrderSource;
    externalReferenceId: string;
    customerName: string;
    totalAmount: number;
    items: {
      productId: string;
      qty: number;
      unitPrice: number;
      lineTotal: number;
    }[];
  }): Promise<SalesOrder> {
    return this.prisma.salesOrder.create({
      data: {
        orderNumber: data.orderNumber,
        source: data.source,
        externalReferenceId: data.externalReferenceId,
        customerName: data.customerName,
        totalAmount: data.totalAmount,
        status: SoStatus.PENDING,
        items: {
          create: data.items.map((i) => ({
            productId: i.productId,
            qty: i.qty,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }

  async createOutboxEvent(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Prisma.InputJsonValue,
  ) {
    return this.prisma.outboxEvent.create({
      data: {
        aggregateType,
        aggregateId,
        eventType,
        payload,
      },
    });
  }
}
