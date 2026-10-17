import { notificationDefaultTemplate } from './notification-default.template.js';
import { otpTemplate } from './otp.template.js';
import type { NotificationTemplate } from './template.types.js';

export type { NotificationTemplate } from './template.types.js';

export const TEMPLATES: Record<string, NotificationTemplate> = {
  [notificationDefaultTemplate.code]: notificationDefaultTemplate,
  [otpTemplate.code]: otpTemplate,
};

export function getTemplate(code: string): NotificationTemplate | undefined {
  return TEMPLATES[code];
}
