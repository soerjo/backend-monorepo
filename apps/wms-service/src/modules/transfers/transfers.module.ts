import { Module } from '@nestjs/common';
import { TransfersService } from './transfers.service.js';
import { TransfersRepository } from './transfers.repository.js';
import { TransfersController } from './transfers.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [TransfersController],
  providers: [TransfersService, TransfersRepository],
  exports: [TransfersService, TransfersRepository],
})
export class TransfersModule {}
