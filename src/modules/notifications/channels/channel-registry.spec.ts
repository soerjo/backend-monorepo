import { NotificationChannel } from '@prisma/client';
import { ChannelRegistry } from './channel-registry.js';
import { FcmChannel } from './fcm.channel.js';
import { WhatsappChannel } from './whatsapp.channel.js';
import { ChannelNotImplementedError } from './notification-channel.interface.js';
import type { NotificationChannel as Channel } from './notification-channel.interface.js';

function stub(channel: NotificationChannel): Channel {
  return {
    channel,
    send: () =>
      Promise.resolve({ ok: true, response: { stub: true }, latencyMs: 0 }),
  };
}

function buildRegistry(): ChannelRegistry {
  return new ChannelRegistry(
    stub(NotificationChannel.TELEGRAM) as never,
    stub(NotificationChannel.EMAIL) as never,
    stub(NotificationChannel.SOCKET_IO) as never,
    stub(NotificationChannel.FCM) as never,
    stub(NotificationChannel.WHATSAPP) as never,
  );
}

describe('ChannelRegistry', () => {
  it('resolves every registered adapter', () => {
    const registry = buildRegistry();

    expect(registry.get(NotificationChannel.TELEGRAM).channel).toBe(
      NotificationChannel.TELEGRAM,
    );
    expect(registry.get(NotificationChannel.EMAIL).channel).toBe(
      NotificationChannel.EMAIL,
    );
    expect(registry.get(NotificationChannel.SOCKET_IO).channel).toBe(
      NotificationChannel.SOCKET_IO,
    );
  });

  it('throws when no adapter is registered for a channel', () => {
    const registry = buildRegistry();
    (
      registry as unknown as { channels: Map<NotificationChannel, Channel> }
    ).channels.clear();

    expect(() => registry.get(NotificationChannel.TELEGRAM)).toThrow(
      'No adapter registered',
    );
  });
});

describe('unimplemented channels', () => {
  const message = {
    notificationId: 'n1',
    channel: NotificationChannel.FCM,
    recipientId: 'u1',
    recipientTarget: 'target',
    title: 't',
    content: 'c',
    payload: {},
    templateCode: null,
  };

  it('FCM rejects with NOT_IMPLEMENTED', async () => {
    const channel = new FcmChannel();
    await expect(channel.send(message)).rejects.toBeInstanceOf(
      ChannelNotImplementedError,
    );
  });

  it('WhatsApp rejects with NOT_IMPLEMENTED', async () => {
    const channel = new WhatsappChannel();
    await expect(
      channel.send({ ...message, channel: NotificationChannel.WHATSAPP }),
    ).rejects.toBeInstanceOf(ChannelNotImplementedError);
  });
});
