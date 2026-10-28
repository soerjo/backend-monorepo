import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdjustmentsService } from './adjustments.service.js';
import { AdjustmentsRepository } from './adjustments.repository.js';
import { AdjustmentsController } from './adjustments.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [PrismaModule, InventoryModule, ConfigModule],
  controllers: [AdjustmentsController],
  providers: [AdjustmentsService, AdjustmentsRepository],
  exports: [AdjustmentsService, AdjustmentsRepository],
})
export class AdjustmentsModule {}
