import { Injectable, NotFoundException } from '@nestjs/common';
import { WebhookDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

const WEBHOOK_ENDPOINT_SELECT = {
  id: true,
  url: true,
  events: true,
  active: true,
  createdAt: true,
} as const;

@Injectable()
export class WebhooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.webhookEndpoint.findMany({
      select: WEBHOOK_ENDPOINT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({
      where: { id },
      select: WEBHOOK_ENDPOINT_SELECT,
    });
    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint with id ${id} not found`);
    }
    return endpoint;
  }

  findActiveByEvent(event: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { active: true, events: { has: event } },
    });
  }

  findActiveByIds(ids: string[]) {
    return this.prisma.webhookEndpoint.findMany({
      where: { active: true, id: { in: ids } },
    });
  }

  create(data: {
    url: string;
    events: string[];
    secretHash: string;
    secretEnc: string;
    active: boolean;
  }) {
    return this.prisma.webhookEndpoint.create({
      data,
      select: WEBHOOK_ENDPOINT_SELECT,
    });
  }

  async update(
    id: string,
    data: { url?: string; events?: string[]; active?: boolean },
  ) {
    await this.findById(id);
    return this.prisma.webhookEndpoint.update({
      where: { id },
      data,
      select: WEBHOOK_ENDPOINT_SELECT,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.webhookEndpoint.delete({
      where: { id },
      select: WEBHOOK_ENDPOINT_SELECT,
    });
  }

  createDelivery(data: {
    endpointId: string;
    event: string;
    status: WebhookDeliveryStatus;
    attempt: number;
    responseCode: number | null;
    latencyMs: number;
  }) {
    return this.prisma.webhookDelivery.create({ data });
  }
}
