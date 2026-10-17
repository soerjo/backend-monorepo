import { Injectable, NotFoundException } from '@nestjs/common';
import { InboundShipmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class InboundRepository {
  constructor(private prisma: PrismaService) {}

  async createShipment(
    data: Prisma.InboundShipmentUncheckedCreateInput & {
      items?: Prisma.InboundShipmentItemUncheckedCreateWithoutShipmentInput[];
    },
  ) {
    const { items, ...shipmentData } = data;
    return this.prisma.inboundShipment.create({
      data: {
        ...shipmentData,
        items: items ? { create: items } : undefined,
      },
      include: { items: true, warehouse: true },
    });
  }

  async findById(id: string) {
    const shipment = await this.prisma.inboundShipment.findUnique({
      where: { id },
      include: { items: true, warehouse: true },
    });
    if (!shipment) {
      throw new NotFoundException(`Inbound shipment with id ${id} not found`);
    }
    return shipment;
  }

  async updateShipmentStatus(
    id: string,
    status: InboundShipmentStatus,
    receivedAt?: Date,
  ) {
    return this.prisma.inboundShipment.update({
      where: { id },
      data: { status, receivedAt },
      include: { items: true },
    });
  }

  async updateItemReceived(itemId: string, quantityReceived: Prisma.Decimal) {
    return this.prisma.inboundShipmentItem.update({
      where: { id: itemId },
      data: { quantityReceived },
    });
  }
}
