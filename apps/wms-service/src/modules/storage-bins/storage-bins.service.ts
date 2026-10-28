import { BadRequestException, Injectable } from '@nestjs/common';
import { StorageBinStatus } from '@prisma/client';
import { StorageBinsRepository } from './storage-bins.repository.js';
import { CreateStorageBinDto } from './dto/create-storage-bin.dto.js';
import { WarehousesRepository } from '../warehouses/warehouses.repository.js';

@Injectable()
export class StorageBinsService {
  constructor(
    private storageBinsRepository: StorageBinsRepository,
    private warehousesRepository: WarehousesRepository,
  ) {}

  async findAllByWarehouse(warehouseId: string, filters = {}) {
    await this.warehousesRepository.findById(warehouseId);
    return this.storageBinsRepository.findAllByWarehouse(warehouseId, filters);
  }

  async create(warehouseId: string, dto: CreateStorageBinDto) {
    await this.warehousesRepository.findById(warehouseId);
    const existing = await this.storageBinsRepository.findByWarehouseAndCode(
      warehouseId,
      dto.binCode,
    );
    if (existing) {
      throw new BadRequestException(
        `Bin ${dto.binCode} already exists in warehouse ${warehouseId}`,
      );
    }
    return this.storageBinsRepository.create(warehouseId, dto);
  }

  async updateStatus(id: string, status: StorageBinStatus) {
    await this.storageBinsRepository.findById(id);
    return this.storageBinsRepository.updateStatus(id, status);
  }
}
