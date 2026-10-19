import { Module, Global } from '@nestjs/common';
import { NodemailerMailService } from './nodemailer-mail.service.js';

/**
 * Mail module (ADR 0004). Exposes a single narrow MailSender provider; no
 * controller, no repository — a pure service-layer facility consumed by
 * AuthService at token-issuance points.
 */
@Global()
@Module({
  providers: [{ provide: 'MailSender', useClass: NodemailerMailService }],
  exports: ['MailSender'],
})
export class MailModule {}

export type {
  MailSender,
  MailSendResult,
  MailTransportMode,
} from './mail.types.js';
