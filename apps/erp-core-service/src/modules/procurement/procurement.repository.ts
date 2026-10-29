import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PoStatus, Prisma, PurchaseOrder, Vendor } from '@prisma/client';
import { CreateVendorDto } from './dto/create-vendor.dto.js';

@Injectable()
export class ProcurementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createVendor(dto: CreateVendorDto): Promise<Vendor> {
    return this.prisma.vendor.create({
      data: dto,
    });
  }

  async findVendorById(id: string): Promise<Vendor | null> {
    return this.prisma.vendor.findUnique({
      where: { id },
    });
  }

  async findVendorByIdOrThrow(id: string): Promise<Vendor> {
    const vendor = await this.findVendorById(id);
    if (!vendor) throw new NotFoundException(`Vendor '${id}' not found`);
    return vendor;
  }

  async findAllVendors(): Promise<Vendor[]> {
    return this.prisma.vendor.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createPurchaseOrder(poData: {
    poNumber: string;
    vendorId: string;
    orderDate: Date;
    expectedDeliveryDate?: Date;
    totalAmount: number;
    taxAmount: number;
    notes?: string;
    createdBy: string;
    items: {
      productId: string;
      qtyOrdered: number;
      unitPrice: number;
      lineTotal: number;
    }[];
  }): Promise<PurchaseOrder> {
    return this.prisma.purchaseOrder.create({
      data: {
        poNumber: poData.poNumber,
        vendor: { connect: { id: poData.vendorId } },
        orderDate: poData.orderDate,
        expectedDeliveryDate: poData.expectedDeliveryDate,
        totalAmount: poData.totalAmount,
        taxAmount: poData.taxAmount,
        notes: poData.notes,
        createdBy: poData.createdBy,
        status: PoStatus.DRAFT,
        items: {
          create: poData.items.map((i) => ({
            product: { connect: { id: i.productId } },
            qtyOrdered: i.qtyOrdered,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
          })),
        },
      },
      include: {
        items: true,
        vendor: true,
      },
    });
  }

  async findPoById(id: string) {
    return this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        vendor: true,
      },
    });
  }

  async findPoByIdOrThrow(id: string) {
    const po = await this.findPoById(id);
    if (!po) throw new NotFoundException(`Purchase Order '${id}' not found`);
    return po;
  }

  async updatePoStatusAndOutbox(
    poId: string,
    newStatus: PoStatus,
    approvedBy: string,
    outboxPayload: Prisma.InputJsonValue,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updatedPo = await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: newStatus,
          approvedBy,
        },
        include: {
          items: true,
          vendor: true,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'PURCHASE_ORDER',
          aggregateId: poId,
          eventType: 'erp.po.approved',
          payload: outboxPayload,
        },
      });

      return updatedPo;
    });
  }
}
