import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';
import { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';
import { AuditPurgeService } from './audit-purge.service.js';

/**
 * AuditModule is exported so any module (auth, roles, permissions, client/webhook
 * management) can inject AuditService and record security-relevant events.
 */
@Module({
  controllers: [AuditController],
  providers: [AuditRepository, AuditService, AuditPurgeService],
  exports: [AuditService],
})
export class AuditModule {}
