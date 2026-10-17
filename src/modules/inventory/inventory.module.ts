import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { InventoryRepository } from './inventory.repository.js';
import { InventoryController } from './inventory.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryRepository],
  exports: [InventoryService, InventoryRepository],
})
export class InventoryModule {}
