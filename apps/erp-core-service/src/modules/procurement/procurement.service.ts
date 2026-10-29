import { BadRequestException, Injectable } from '@nestjs/common';
import { ProcurementRepository } from './procurement.repository.js';
import { CreateVendorDto } from './dto/create-vendor.dto.js';
import { CreatePoDto } from './dto/create-po.dto.js';
import { PoStatus } from '@prisma/client';

@Injectable()
export class ProcurementService {
  constructor(private readonly repository: ProcurementRepository) {}

  async createVendor(dto: CreateVendorDto) {
    return this.repository.createVendor(dto);
  }

  async listVendors() {
    return this.repository.findAllVendors();
  }

  async createPo(dto: CreatePoDto, createdBy: string) {
    await this.repository.findVendorByIdOrThrow(dto.vendorId);

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('PO must contain at least one item');
    }

    let subtotal = 0;
    const items = dto.items.map((item) => {
      const lineTotal = Number(item.qtyOrdered) * Number(item.unitPrice);
      subtotal += lineTotal;
      return {
        productId: item.productId,
        qtyOrdered: item.qtyOrdered,
        unitPrice: item.unitPrice,
        lineTotal,
      };
    });

    // 11% PPN tax calculation
    const taxAmount = Math.round(subtotal * 0.11 * 100) / 100;
    const totalAmount = subtotal + taxAmount;
    const poNumber = `PO-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    return this.repository.createPurchaseOrder({
      poNumber,
      vendorId: dto.vendorId,
      orderDate: new Date(),
      expectedDeliveryDate: dto.expectedDeliveryDate
        ? new Date(dto.expectedDeliveryDate)
        : undefined,
      totalAmount,
      taxAmount,
      notes: dto.notes,
      createdBy,
      items,
    });
  }

  async getPoDetail(id: string) {
    return this.repository.findPoByIdOrThrow(id);
  }

  async approvePo(id: string, approvedBy: string) {
    const po = await this.repository.findPoByIdOrThrow(id);

    if (po.status !== PoStatus.DRAFT && po.status !== PoStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve PO in status '${po.status}'. Must be DRAFT or SUBMITTED.`,
      );
    }

    // ASN Payload for WMS Inbound Notification
    const asnPayload = {
      poId: po.id,
      poNumber: po.poNumber,
      vendorId: po.vendorId,
      expectedDeliveryDate: po.expectedDeliveryDate,
      items: po.items.map((i) => ({
        productId: i.productId,
        qtyOrdered: i.qtyOrdered,
      })),
      timestamp: new Date().toISOString(),
    };

    const updated = await this.repository.updatePoStatusAndOutbox(
      id,
      PoStatus.APPROVED,
      approvedBy,
      asnPayload,
    );

    return {
      poId: updated.id,
      status: updated.status,
      approvedBy,
    };
  }
}
