import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { NotificationChannel as ChannelType } from '@prisma/client';
import type {
  ChannelMessage,
  ChannelSendResult,
  NotificationChannel,
} from './notification-channel.interface.js';

@Injectable()
export class TelegramChannel implements NotificationChannel {
  readonly channel = ChannelType.TELEGRAM;

  private readonly logger = new Logger(TelegramChannel.name);
  private readonly bot: Telegraf | null;

  constructor(configService: ConfigService) {
    const token = configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.bot = token ? new Telegraf(token) : null;
  }

  async send(message: ChannelMessage): Promise<ChannelSendResult> {
    if (!this.bot) {
      throw new Error('Telegram channel is not configured');
    }

    const start = performance.now();
    const result = await this.bot.telegram.sendMessage(
      message.recipientTarget,
      message.content,
      { parse_mode: 'HTML' },
    );
    const latencyMs = Math.round(performance.now() - start);

    this.logger.log(
      `Telegram message sent to chat ${message.recipientTarget} (message_id=${result.message_id})`,
    );

    return {
      ok: true,
      response: {
        message_id: result.message_id,
        chat_id: message.recipientTarget,
      },
      latencyMs,
    };
  }
}
