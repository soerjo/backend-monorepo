import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

const AUDIT_LOG_SELECT = {
  id: true,
  actorId: true,
  actorType: true,
  action: true,
  severity: true,
  subjectType: true,
  subjectId: true,
  ip: true,
  userAgent: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

@Injectable()
export class AuditRepository {
  constructor(private prisma: PrismaService) {}

  create(
    data: Prisma.AuditLogCreateInput,
  ): Promise<Prisma.AuditLogGetPayload<{ select: typeof AUDIT_LOG_SELECT }>> {
    return this.prisma.auditLog.create({ data, select: AUDIT_LOG_SELECT });
  }

  async findMany(
    where: Prisma.AuditLogWhereInput,
    page: number,
    limit: number,
  ): Promise<{
    items: Prisma.AuditLogGetPayload<{ select: typeof AUDIT_LOG_SELECT }>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        select: AUDIT_LOG_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  purge(olderThan: Date): Promise<number> {
    return this.prisma.auditLog
      .deleteMany({ where: { createdAt: { lt: olderThan } } })
      .then((r) => r.count);
  }
}
