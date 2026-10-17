import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { NotificationChannel, Prisma } from '@prisma/client';
import { sanitize } from '../../common/utils/sanitizer.util.js';
import { TemplateService } from './templates/template.service.js';
import {
  NotificationsRepository,
  type CreateNotificationInput,
} from './notifications.repository.js';
import { NotificationsQueueService } from './notifications.queue.js';
import {
  SendNotificationDto,
  type NotificationDestinationDto,
} from './dto/send-notification.dto.js';

const MAX_IDEMPOTENCY_KEY_LENGTH = 255;
const MAX_TITLE_LENGTH = 255;

interface ResolvedRecipient {
  recipientId: string;
  destination: NotificationDestinationDto;
}

export interface SendResult {
  notificationIds: string[];
  traceId: string;
  idempotent: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly repository: NotificationsRepository,
    private readonly templateService: TemplateService,
    private readonly queue: NotificationsQueueService,
  ) {}

  async send(dto: SendNotificationDto): Promise<SendResult> {
    const baseIdempotencyKey = dto.idempotency_key.slice(
      0,
      MAX_IDEMPOTENCY_KEY_LENGTH,
    );

    const existing =
      await this.repository.findByBaseIdempotencyKey(baseIdempotencyKey);
    if (existing.length > 0) {
      return {
        notificationIds: existing.map((notification) => notification.id),
        traceId: existing[0].traceId,
        idempotent: true,
      };
    }

    const traceId = dto.trace_id ?? randomUUID();
    const recipients = this.buildRecipients(dto);
    const items = this.buildItems(dto, recipients, traceId, baseIdempotencyKey);

    const notificationIds: string[] = [];
    let createdAny = false;

    for (const item of items) {
      const { notification, created } = await this.persist(item);
      notificationIds.push(notification.id);
      if (created) {
        createdAny = true;
        await this.queue.enqueue(notification.id);
      }
    }

    return { notificationIds, traceId, idempotent: !createdAny };
  }

  async getLogs(notificationId: string) {
    await this.repository.findById(notificationId);
    return this.repository.findDeliveryLogs(notificationId);
  }

  private buildRecipients(dto: SendNotificationDto): ResolvedRecipient[] {
    if (dto.recipients && dto.recipients.length > 0) {
      return dto.recipients.map((recipient) => ({
        recipientId: recipient.recipient_id,
        destination: recipient.destination ?? dto.destination ?? {},
      }));
    }

    if (dto.recipient_id) {
      return [
        {
          recipientId: dto.recipient_id,
          destination: dto.destination ?? {},
        },
      ];
    }

    throw new BadRequestException(
      'Either recipient_id or recipients must be provided',
    );
  }

  private buildItems(
    dto: SendNotificationDto,
    recipients: ResolvedRecipient[],
    traceId: string,
    baseIdempotencyKey: string,
  ): CreateNotificationInput[] {
    const items: CreateNotificationInput[] = [];

    for (const recipient of recipients) {
      for (const channel of dto.channels) {
        const recipientTarget = this.resolveTarget(
          channel,
          recipient.destination,
        );
        const { title, content } = this.renderContent(dto, recipient);

        items.push({
          traceId,
          idempotencyKey: this.deriveIdempotencyKey(
            baseIdempotencyKey,
            recipients.length,
            dto.channels.length,
            channel,
            recipient.recipientId,
          ),
          channel,
          recipientId: recipient.recipientId,
          recipientTarget,
          templateCode: dto.template_code ?? null,
          title,
          content,
          payload: sanitize({
            metadata: dto.metadata ?? {},
            content: dto.content ?? {},
            destination: recipient.destination,
          }) as Prisma.InputJsonValue,
        });
      }
    }

    return items;
  }

  private resolveTarget(
    channel: NotificationChannel,
    destination: NotificationDestinationDto,
  ): string {
    let target: string | undefined;
    switch (channel) {
      case NotificationChannel.SOCKET_IO:
        target = destination.socket_room;
        break;
      case NotificationChannel.TELEGRAM:
        target = destination.telegram_chat_id;
        break;
      case NotificationChannel.EMAIL:
        target = destination.email;
        break;
      case NotificationChannel.FCM:
        target = destination.fcm_token;
        break;
      case NotificationChannel.WHATSAPP:
        target = destination.whatsapp_number;
        break;
      default:
        target = undefined;
    }

    if (!target) {
      throw new BadRequestException(
        `Missing destination target for channel ${channel}`,
      );
    }

    return target;
  }

  private renderContent(
    dto: SendNotificationDto,
    recipient: ResolvedRecipient,
  ): { title: string; content: string } {
    const context: Record<string, unknown> = {
      ...(dto.metadata ?? {}),
      ...(dto.content ?? {}),
      recipient_id: recipient.recipientId,
    };

    if (dto.template_code) {
      if (!this.templateService.has(dto.template_code)) {
        throw new BadRequestException(
          `Unknown template_code: ${dto.template_code}`,
        );
      }
      const rendered = this.templateService.render(dto.template_code, context);
      return {
        title: rendered.title.slice(0, MAX_TITLE_LENGTH),
        content: rendered.body,
      };
    }

    const content = dto.content?.body;
    if (!content) {
      throw new BadRequestException(
        'content.body is required when template_code is not provided',
      );
    }

    return {
      title: (dto.content?.title ?? '').slice(0, MAX_TITLE_LENGTH),
      content,
    };
  }

  private deriveIdempotencyKey(
    base: string,
    recipientCount: number,
    channelCount: number,
    channel: NotificationChannel,
    recipientId: string,
  ): string {
    if (recipientCount === 1 && channelCount === 1) {
      return base.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
    }

    const raw = `${base}::${channel}::${recipientId}`;
    if (raw.length <= MAX_IDEMPOTENCY_KEY_LENGTH) {
      return raw;
    }
    return createHash('sha256').update(raw).digest('hex');
  }

  private async persist(
    item: CreateNotificationInput,
  ): Promise<{ notification: { id: string }; created: boolean }> {
    const existing = await this.repository.findByIdempotencyKey(
      item.idempotencyKey,
    );
    if (existing) {
      return { notification: existing, created: false };
    }

    try {
      const notification = await this.repository.create(item);
      return { notification, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.repository.findByIdempotencyKey(
          item.idempotencyKey,
        );
        if (raced) {
          return { notification: raced, created: false };
        }
      }
      throw error;
    }
  }
}
