import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller.js';
import { IntegrationService } from './integration.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
