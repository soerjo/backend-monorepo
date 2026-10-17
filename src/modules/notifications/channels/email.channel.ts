import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { NotificationChannel as ChannelType } from '@prisma/client';
import { TemplateService } from '../templates/template.service.js';
import type {
  ChannelMessage,
  ChannelSendResult,
  NotificationChannel,
} from './notification-channel.interface.js';

@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly channel = ChannelType.EMAIL;

  private readonly logger = new Logger(EmailChannel.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(
    configService: ConfigService,
    private readonly templateService: TemplateService,
  ) {
    const host = configService.get<string>('SMTP_HOST');
    const port = Number(configService.get<string>('SMTP_PORT') ?? 587);
    const user = configService.get<string>('SMTP_USER');
    const pass = configService.get<string>('SMTP_PASS');
    this.from =
      configService.get<string>('SMTP_FROM') ?? 'notifications@localhost';

    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: user ? { user, pass } : undefined,
        })
      : null;
  }

  async send(message: ChannelMessage): Promise<ChannelSendResult> {
    if (!this.transporter) {
      throw new Error('Email channel is not configured');
    }

    const html = this.templateService.has(message.templateCode ?? '')
      ? this.templateService.renderBody(
          message.templateCode as string,
          message.payload,
        )
      : message.content;

    const start = performance.now();
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.recipientTarget,
      subject: message.title,
      html,
      text: message.content,
    });
    const latencyMs = Math.round(performance.now() - start);

    this.logger.log(
      `Email sent to ${message.recipientTarget} (messageId=${info.messageId})`,
    );

    return {
      ok: true,
      response: {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      },
      latencyMs,
    };
  }
}
