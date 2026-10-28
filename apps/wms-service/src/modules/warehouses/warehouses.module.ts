import { Module } from '@nestjs/common';
import { WarehousesController } from './warehouses.controller.js';
import { WarehousesService } from './warehouses.service.js';
import { WarehousesRepository } from './warehouses.repository.js';

@Module({
  controllers: [WarehousesController],
  providers: [WarehousesService, WarehousesRepository],
  exports: [WarehousesService, WarehousesRepository],
})
export class WarehousesModule {}
