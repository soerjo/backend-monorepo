import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel as ChannelType } from '@prisma/client';
import {
  ChannelNotImplementedError,
  type ChannelMessage,
  type ChannelSendResult,
  type NotificationChannel,
} from './notification-channel.interface.js';

@Injectable()
export class WhatsappChannel implements NotificationChannel {
  readonly channel = ChannelType.WHATSAPP;

  private readonly logger = new Logger(WhatsappChannel.name);

  send(message: ChannelMessage): Promise<ChannelSendResult> {
    this.logger.warn(
      `WhatsApp channel not implemented; notification ${message.notificationId} cannot be dispatched`,
    );
    return Promise.reject(new ChannelNotImplementedError(this.channel));
  }
}
