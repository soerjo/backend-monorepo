import { Injectable } from '@nestjs/common';
import { StockLedgerRefType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class InventoryRepository {
  constructor(private prisma: PrismaService) {}

  async findOnHand(filters: {
    warehouseId?: string;
    sku?: string;
    batchNumber?: string;
  }) {
    return this.prisma.productStock.findMany({
      where: {
        warehouseId: filters.warehouseId,
        sku: filters.sku,
        batchNumber: filters.batchNumber,
        quantityOnHand: { gt: 0 },
      },
      include: {
        warehouse: true,
        bin: true,
      },
      orderBy: [{ sku: 'asc' }, { expiryDate: 'asc' }],
    });
  }

  async findLedger(filters: {
    warehouseId?: string;
    sku?: string;
    referenceType?: StockLedgerRefType;
    startDate?: Date;
    endDate?: Date;
  }) {
    return this.prisma.stockLedger.findMany({
      where: {
        warehouseId: filters.warehouseId,
        sku: filters.sku,
        referenceType: filters.referenceType,
        transactionTime: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      },
      include: {
        warehouse: true,
        bin: true,
      },
      orderBy: { transactionTime: 'desc' },
    });
  }

  async findLowStock(warehouseId?: string, threshold = 10) {
    return this.prisma.productStock.findMany({
      where: {
        warehouseId,
        quantityOnHand: { lte: threshold, gt: 0 },
      },
      include: {
        warehouse: true,
        bin: true,
      },
      orderBy: { quantityOnHand: 'asc' },
    });
  }

  async findStockForAllocation(
    warehouseId: string,
    sku: string,
    strategy: 'FEFO' | 'FIFO',
  ) {
    return this.prisma.productStock.findMany({
      where: {
        warehouseId,
        sku,
        quantityOnHand: { gt: 0 },
        bin: {
          status: 'ACTIVE',
        },
      },
      include: {
        bin: true,
      },
      orderBy:
        strategy === 'FEFO'
          ? [{ expiryDate: 'asc' }, { updatedAt: 'asc' }]
          : [{ updatedAt: 'asc' }, { expiryDate: 'asc' }],
    });
  }
}
