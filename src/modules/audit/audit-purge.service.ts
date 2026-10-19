import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { AuditService } from './audit.service.js';

@Injectable()
export class AuditPurgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditPurgeService.name);
  private purgeInterval: NodeJS.Timeout | null = null;
  private readonly PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly auditService: AuditService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      this.logger.log('Audit log purge interval skipped in test environment.');
      return;
    }

    this.logger.log('Scheduling audit log purge...');
    // Run immediately on startup, then every 24 hours
    void this.schedulePurge();
    this.purgeInterval = setInterval(() => {
      void this.schedulePurge();
    }, this.PURGE_INTERVAL_MS);
    this.purgeInterval.unref(); // Allow Node.js process to exit if only this interval is running
  }

  onModuleDestroy() {
    if (this.purgeInterval) {
      clearInterval(this.purgeInterval);
      this.purgeInterval = null;
      this.logger.log('Audit log purge interval cleared.');
    }
  }

  private async schedulePurge() {
    try {
      const purgedCount = await this.auditService.purge();
      this.logger.log(
        `[AuditPurge] Purged ${purgedCount} audit logs older than retention window.`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[AuditPurge] Error during audit log purge: ${message}`,
        stack,
      );
    }
  }
}
