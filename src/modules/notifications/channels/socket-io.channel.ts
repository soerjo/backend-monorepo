import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel as ChannelType } from '@prisma/client';
import {
  NotificationsGateway,
  NOTIFICATION_ROOM_EVENT,
} from '../gateway/notifications.gateway.js';
import type {
  ChannelMessage,
  ChannelSendResult,
  NotificationChannel,
} from './notification-channel.interface.js';

@Injectable()
export class SocketIoChannel implements NotificationChannel {
  readonly channel = ChannelType.SOCKET_IO;

  private readonly logger = new Logger(SocketIoChannel.name);

  constructor(private readonly gateway: NotificationsGateway) {}

  send(message: ChannelMessage): Promise<ChannelSendResult> {
    const start = performance.now();
    const delivered = this.gateway.emitToRoom(
      message.recipientTarget,
      NOTIFICATION_ROOM_EVENT,
      {
        notificationId: message.notificationId,
        title: message.title,
        content: message.content,
        payload: message.payload,
        timestamp: new Date().toISOString(),
      },
    );

    const latencyMs = Math.round(performance.now() - start);
    this.logger.log(
      `Socket.IO event ${NOTIFICATION_ROOM_EVENT} emitted to room ${message.recipientTarget} (delivered=${delivered})`,
    );

    return Promise.resolve({
      ok: true,
      response: {
        room: message.recipientTarget,
        event: NOTIFICATION_ROOM_EVENT,
        delivered,
      },
      latencyMs,
    });
  }
}
