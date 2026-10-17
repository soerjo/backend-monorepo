import { Module } from '@nestjs/common';
import { WarehousesModule } from '../warehouses/warehouses.module.js';
import {
  WarehouseBinsController,
  StorageBinsController,
} from './storage-bins.controller.js';
import { StorageBinsService } from './storage-bins.service.js';
import { StorageBinsRepository } from './storage-bins.repository.js';

@Module({
  imports: [WarehousesModule],
  controllers: [WarehouseBinsController, StorageBinsController],
  providers: [StorageBinsService, StorageBinsRepository],
  exports: [StorageBinsService, StorageBinsRepository],
})
export class StorageBinsModule {}
