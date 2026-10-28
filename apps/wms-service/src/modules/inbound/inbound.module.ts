import { Module } from '@nestjs/common';
import { InboundService } from './inbound.service.js';
import { InboundRepository } from './inbound.repository.js';
import { InboundController } from './inbound.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [InboundController],
  providers: [InboundService, InboundRepository],
  exports: [InboundService, InboundRepository],
})
export class InboundModule {}
