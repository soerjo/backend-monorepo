import type { NotificationTemplate } from './template.types.js';

export const otpTemplate: NotificationTemplate = {
  code: 'otp',
  title: 'Your One-Time Password',
  body: 'Your OTP code is {{otp}}. It expires in {{expires_in_minutes}} minutes. Do not share this code with anyone.',
};
