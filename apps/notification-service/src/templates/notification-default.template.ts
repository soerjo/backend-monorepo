import type { NotificationTemplate } from './template.types.js';

export const notificationDefaultTemplate: NotificationTemplate = {
  code: 'notification-default',
  title: '{{#if title}}{{title}}{{else}}Notification{{/if}}',
  body: '{{#if body}}{{body}}{{else}}{{greeting}}{{/if}}',
};
