import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WarehouseType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface WarehouseFilters {
  type?: WarehouseType;
  isActive?: boolean;
}

@Injectable()
export class WarehousesRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: WarehouseFilters = {}) {
    return this.prisma.warehouse.findMany({
      where: {
        type: filters.type,
        isActive: filters.isActive,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with id ${id} not found`);
    }
    return warehouse;
  }

  async findByCode(code: string) {
    return this.prisma.warehouse.findUnique({ where: { code } });
  }

  async create(data: Prisma.WarehouseCreateInput) {
    return this.prisma.warehouse.create({ data });
  }

  async update(id: string, data: Prisma.WarehouseUpdateInput) {
    return this.prisma.warehouse.update({ where: { id }, data });
  }
}
