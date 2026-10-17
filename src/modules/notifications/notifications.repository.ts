import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  DeliveryLogStatus,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface CreateNotificationInput {
  traceId: string;
  idempotencyKey: string;
  channel: NotificationChannel;
  recipientId: string;
  recipientTarget: string;
  templateCode: string | null;
  title: string;
  content: string;
  payload: Prisma.InputJsonValue;
}

export interface UpdateNotificationStatusInput {
  status: NotificationStatus;
  retryCount: number;
}

export interface CreateDeliveryLogInput {
  notificationId: string;
  attempt: number;
  status: DeliveryLogStatus;
  providerResponse: Prisma.InputJsonValue;
  latencyMs: number;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.notification.findUnique({
      where: { idempotencyKey },
    });
  }

  create(input: CreateNotificationInput) {
    return this.prisma.notification.create({ data: input });
  }

  async findById(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException(`Notification with id ${id} not found`);
    }
    return notification;
  }

  updateStatus(id: string, input: UpdateNotificationStatusInput) {
    return this.prisma.notification.update({
      where: { id },
      data: input,
    });
  }

  createDeliveryLog(input: CreateDeliveryLogInput) {
    return this.prisma.notificationDeliveryLog.create({ data: input });
  }

  async findDeliveryLogs(notificationId: string) {
    const logs = await this.prisma.notificationDeliveryLog.findMany({
      where: { notificationId },
      orderBy: { id: 'asc' },
    });
    return logs.map((log) => ({ ...log, id: log.id.toString() }));
  }
}
