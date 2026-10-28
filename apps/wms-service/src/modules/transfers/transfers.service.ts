import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TransfersRepository } from './transfers.repository.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { BinTransferDto } from './dto/bin-transfer.dto.js';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transfersRepository: TransfersRepository,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(dto: CreateTransferDto) {
    return this.prisma.stockTransfer.create({
      data: {
        transferNo: dto.transferNo,
        originWarehouseId: dto.originWarehouseId,
        destinationWarehouseId: dto.destinationWarehouseId,
        status: 'DRAFT',
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            sku: item.sku,
            batchNumber: item.batchNumber || '-',
            quantity: new Prisma.Decimal(item.quantity),
          })),
        },
      },
      include: { items: true },
    });
  }

  async dispatch(id: string) {
    const transfer = await this.transfersRepository.findById(id);
    if (transfer.status !== 'DRAFT') {
      throw new BadRequestException(
        `Transfer ${transfer.transferNo} is not in DRAFT status (current: ${transfer.status})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const qty = new Prisma.Decimal(item.quantity);
        // Allocate stock using FEFO at origin warehouse
        const allocations = await this.inventoryService.allocateStock(
          transfer.originWarehouseId,
          item.sku,
          qty,
          'FEFO',
        );

        for (const alloc of allocations) {
          await this.inventoryService.recordStockMovement(tx, {
            warehouseId: transfer.originWarehouseId,
            binId: alloc.binId,
            productId: item.productId,
            sku: item.sku,
            batchNumber: alloc.batchNumber,
            expiryDate: alloc.expiryDate,
            changeQuantity: new Prisma.Decimal(
              alloc.quantityToDeduct,
            ).negated(),
            referenceType: 'TRANSFER_OUT',
            referenceId: transfer.id,
            notes: `Dispatch transfer ${transfer.transferNo}`,
          });
        }
      }

      return tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'IN_TRANSIT',
          dispatchedAt: new Date(),
        },
        include: { items: true },
      });
    });
  }

  async receive(id: string, destinationBinId: string) {
    const transfer = await this.transfersRepository.findById(id);
    if (transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException(
        `Transfer ${transfer.transferNo} is not IN_TRANSIT (current: ${transfer.status})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const targetBin = await tx.storageBin.findUnique({
        where: { id: destinationBinId },
      });
      if (
        !targetBin ||
        targetBin.warehouseId !== transfer.destinationWarehouseId
      ) {
        throw new NotFoundException(
          `Destination storage bin ${destinationBinId} not found in destination warehouse`,
        );
      }
      if (targetBin.status !== 'ACTIVE') {
        throw new BadRequestException(`Destination storage bin is not ACTIVE`);
      }

      for (const item of transfer.items) {
        const qty = new Prisma.Decimal(item.quantity);
        await this.inventoryService.recordStockMovement(tx, {
          warehouseId: transfer.destinationWarehouseId,
          binId: destinationBinId,
          productId: item.productId,
          sku: item.sku,
          batchNumber: item.batchNumber,
          changeQuantity: qty,
          referenceType: 'TRANSFER_IN',
          referenceId: transfer.id,
          notes: `Receive transfer ${transfer.transferNo}`,
        });
      }

      return tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'COMPLETED',
          receivedAt: new Date(),
        },
        include: { items: true },
      });
    });
  }

  async binTransfer(dto: BinTransferDto) {
    return this.prisma.$transaction(async (tx) => {
      const targetBin = await tx.storageBin.findUnique({
        where: { id: dto.targetBinId },
      });
      if (!targetBin || targetBin.warehouseId !== dto.warehouseId) {
        throw new NotFoundException(`Target bin not found in warehouse`);
      }
      if (targetBin.status !== 'ACTIVE') {
        throw new BadRequestException(`Target bin is not ACTIVE`);
      }

      const qty = new Prisma.Decimal(dto.quantity);
      const expiry = dto.expiryDate ? new Date(dto.expiryDate) : null;
      const batch = dto.batchNumber || '-';

      // Deduct from source bin
      await this.inventoryService.recordStockMovement(tx, {
        warehouseId: dto.warehouseId,
        binId: dto.sourceBinId,
        productId: dto.productId,
        sku: dto.sku,
        batchNumber: batch,
        expiryDate: expiry,
        changeQuantity: qty.negated(),
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: 'BIN-TRANSFER',
        notes: `Bin transfer out from ${dto.sourceBinId}`,
      });

      // Add to target bin
      await this.inventoryService.recordStockMovement(tx, {
        warehouseId: dto.warehouseId,
        binId: dto.targetBinId,
        productId: dto.productId,
        sku: dto.sku,
        batchNumber: batch,
        expiryDate: expiry,
        changeQuantity: qty,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: 'BIN-TRANSFER',
        notes: `Bin transfer in to target bin ${targetBin.binCode}`,
      });

      return {
        success: true,
        message: `Successfully transferred ${qty.toString()} units of SKU ${dto.sku} from source bin to ${targetBin.binCode}`,
      };
    });
  }
}
