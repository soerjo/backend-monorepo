import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InboundRepository } from './inbound.repository.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { CreateReceiptDto } from './dto/create-receipt.dto.js';
import { PutawayDto } from './dto/putaway.dto.js';

@Injectable()
export class InboundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inboundRepository: InboundRepository,
    private readonly inventoryService: InventoryService,
  ) {}

  async createReceipt(dto: CreateReceiptDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create shipment and items
      const shipment = await tx.inboundShipment.create({
        data: {
          shipmentNo: dto.shipmentNo,
          warehouseId: dto.warehouseId,
          supplierId: dto.supplierId,
          referencePoNo: dto.referencePoNo,
          status: 'PENDING',
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              sku: item.sku,
              batchNumber: item.batchNumber || '-',
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              quantity: new Prisma.Decimal(item.quantity),
              quantityReceived: new Prisma.Decimal(0),
            })),
          },
        },
        include: { items: true },
      });

      // 2. Process receipt into receiving bin via stock movement
      for (const item of shipment.items) {
        const qty = new Prisma.Decimal(item.quantity);
        await this.inventoryService.recordStockMovement(tx, {
          warehouseId: dto.warehouseId,
          binId: dto.receivingBinId,
          productId: item.productId,
          sku: item.sku,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          changeQuantity: qty,
          referenceType: 'INBOUND_PO',
          referenceId: shipment.id,
          notes: `Inbound receipt ${dto.shipmentNo}`,
        });

        await tx.inboundShipmentItem.update({
          where: { id: item.id },
          data: { quantityReceived: qty },
        });
      }

      // 3. Mark shipment COMPLETED
      const updatedShipment = await tx.inboundShipment.update({
        where: { id: shipment.id },
        data: {
          status: 'COMPLETED',
          receivedAt: new Date(),
        },
        include: { items: true },
      });

      return updatedShipment;
    });
  }

  async putaway(dto: PutawayDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate target bin is ACTIVE
      const targetBin = await tx.storageBin.findUnique({
        where: { id: dto.targetBinId },
      });
      if (!targetBin) {
        throw new NotFoundException(
          `Target storage bin ${dto.targetBinId} not found`,
        );
      }
      if (targetBin.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Target storage bin ${targetBin.binCode} is not ACTIVE (status: ${targetBin.status})`,
        );
      }

      // 2. Find shipment item
      const item = await tx.inboundShipmentItem.findUnique({
        where: { id: dto.itemId },
      });
      if (!item) {
        throw new NotFoundException(
          `Inbound shipment item ${dto.itemId} not found`,
        );
      }

      const shipment = await tx.inboundShipment.findUnique({
        where: { id: dto.shipmentId },
      });
      if (!shipment) {
        throw new NotFoundException(
          `Inbound shipment ${dto.shipmentId} not found`,
        );
      }

      const qty = new Prisma.Decimal(dto.quantity);

      // 3. Deduct from source bin (receiving bin)
      await this.inventoryService.recordStockMovement(tx, {
        warehouseId: shipment.warehouseId,
        binId: dto.sourceBinId,
        productId: item.productId,
        sku: item.sku,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        changeQuantity: qty.negated(),
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: shipment.id,
        notes: `Putaway transfer out from source bin ${dto.sourceBinId}`,
      });

      // 4. Add to target bin
      await this.inventoryService.recordStockMovement(tx, {
        warehouseId: shipment.warehouseId,
        binId: dto.targetBinId,
        productId: item.productId,
        sku: item.sku,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        changeQuantity: qty,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: shipment.id,
        notes: `Putaway transfer in to target bin ${targetBin.binCode}`,
      });

      return {
        success: true,
        message: `Successfully put away ${qty.toString()} of SKU ${item.sku} into bin ${targetBin.binCode}`,
      };
    });
  }
}
