import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  FederationAdminController,
  FederationBrowserController,
} from './federation.controller.js';
import { FederationService } from './federation.service.js';
import { FederationRepository } from './federation.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [FederationAdminController, FederationBrowserController],
  providers: [FederationService, FederationRepository],
  exports: [FederationService],
})
export class FederationModule {}
