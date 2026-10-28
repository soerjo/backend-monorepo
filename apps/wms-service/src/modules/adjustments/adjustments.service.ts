import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdjustmentsRepository } from './adjustments.repository.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto.js';
import { ApproveAdjustmentDto } from './dto/approve-adjustment.dto.js';

@Injectable()
export class AdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly adjustmentsRepository: AdjustmentsRepository,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(dto: CreateAdjustmentDto) {
    const thresholdStr =
      this.configService.get<string>('WMS_APPROVAL_THRESHOLD') ?? '0';
    const threshold = Number(thresholdStr);
    const reqValue = dto.requestedValue ?? 0;
    const isAutoApproved = reqValue <= threshold;
    const status = isAutoApproved ? 'APPROVED' : 'PENDING';

    return this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNo: dto.adjustmentNo,
          warehouseId: dto.warehouseId,
          reason: dto.reason,
          status,
          requestedValue:
            dto.requestedValue !== undefined
              ? new Prisma.Decimal(dto.requestedValue)
              : null,
          notes: dto.notes,
          items: {
            create: dto.items.map((item) => ({
              binId: item.binId,
              productId: item.productId,
              sku: item.sku,
              batchNumber: item.batchNumber || '-',
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              currentQuantity: new Prisma.Decimal(item.currentQuantity),
              adjustedQuantity: new Prisma.Decimal(item.adjustedQuantity),
            })),
          },
        },
        include: { items: true },
      });

      if (status === 'APPROVED') {
        for (const item of adjustment.items) {
          const changeQty = new Prisma.Decimal(item.adjustedQuantity).minus(
            item.currentQuantity,
          );
          await this.inventoryService.recordStockMovement(tx, {
            warehouseId: dto.warehouseId,
            binId: item.binId,
            productId: item.productId,
            sku: item.sku,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            changeQuantity: changeQty,
            referenceType: 'STOCK_ADJUSTMENT',
            referenceId: adjustment.id,
            notes: `Stock adjustment ${dto.adjustmentNo} (${dto.reason})`,
            allowNegative: true,
          });
        }
      }

      return adjustment;
    });
  }

  async approve(id: string, dto: ApproveAdjustmentDto) {
    const adjustment = await this.adjustmentsRepository.findById(id);
    if (adjustment.status !== 'PENDING') {
      throw new BadRequestException(
        `Adjustment ${adjustment.adjustmentNo} is not PENDING (current: ${adjustment.status})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of adjustment.items) {
        const changeQty = new Prisma.Decimal(item.adjustedQuantity).minus(
          item.currentQuantity,
        );
        await this.inventoryService.recordStockMovement(tx, {
          warehouseId: adjustment.warehouseId,
          binId: item.binId,
          productId: item.productId,
          sku: item.sku,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          changeQuantity: changeQty,
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: adjustment.id,
          notes: `Approved stock adjustment ${adjustment.adjustmentNo}`,
          allowNegative: true,
        });
      }

      return tx.stockAdjustment.update({
        where: { id: adjustment.id },
        data: {
          status: 'APPROVED',
          approverId: dto.approverId,
        },
        include: { items: true },
      });
    });
  }
}
