import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async emit(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    this.logger.log(
      `Emit outbox event: [${aggregateType}] ${aggregateId} -> ${eventType}`,
    );

    return client.outboxEvent.create({
      data: {
        aggregateType,
        aggregateId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });
  }
}
