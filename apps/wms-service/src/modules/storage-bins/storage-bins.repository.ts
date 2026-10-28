import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StorageBinStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface BinFilters {
  status?: StorageBinStatus;
  zoneName?: string;
}

@Injectable()
export class StorageBinsRepository {
  constructor(private prisma: PrismaService) {}

  async findAllByWarehouse(warehouseId: string, filters: BinFilters = {}) {
    return this.prisma.storageBin.findMany({
      where: {
        warehouseId,
        status: filters.status,
        zoneName: filters.zoneName,
      },
      orderBy: { binCode: 'asc' },
    });
  }

  async findById(id: string) {
    const bin = await this.prisma.storageBin.findUnique({ where: { id } });
    if (!bin) {
      throw new NotFoundException(`Storage bin with id ${id} not found`);
    }
    return bin;
  }

  async findByWarehouseAndCode(warehouseId: string, binCode: string) {
    return this.prisma.storageBin.findUnique({
      where: { warehouseId_binCode: { warehouseId, binCode } },
    });
  }

  async create(
    warehouseId: string,
    data: Omit<Prisma.StorageBinUncheckedCreateInput, 'warehouseId'>,
  ) {
    return this.prisma.storageBin.create({
      data: { ...data, warehouseId },
    });
  }

  async updateStatus(id: string, status: StorageBinStatus) {
    return this.prisma.storageBin.update({ where: { id }, data: { status } });
  }
}
