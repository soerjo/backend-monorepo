import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditRepository } from './audit.repository.js';

export interface AuditLogEntry {
  action: string;
  actorId?: string;
  actorType?: string;
  severity?: 'info' | 'warn' | 'critical';
  subjectType?: string;
  subjectId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  /**
   * Fire-and-forget audit logging. Never throws — an audit failure must not
   * break the business action that produced the entry.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.auditRepository.create({
        action: entry.action,
        actorId: entry.actorId,
        actorType: entry.actorType ?? 'user',
        severity: entry.severity ?? 'info',
        subjectType: entry.subjectType,
        subjectId: entry.subjectId,
        ip: entry.ip,
        userAgent: entry.userAgent,
        metadata: (entry.metadata ?? undefined) as
          Prisma.InputJsonValue | undefined,
      });
    } catch (err) {
      this.logger.warn(
        `audit log failed for action=${entry.action}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findLogs(query: {
    page?: number;
    limit?: number;
    action?: string;
    severity?: string;
    actorId?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = query.action;
    if (query.severity) where.severity = query.severity;
    if (query.actorId) where.actorId = query.actorId;
    return this.auditRepository.findMany(where, page, limit);
  }

  async purge(): Promise<number> {
    const retentionDays = Number(process.env.AUDIT_RETENTION_DAYS ?? 30);
    const olderThan = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );
    return this.auditRepository.purge(olderThan);
  }
}
