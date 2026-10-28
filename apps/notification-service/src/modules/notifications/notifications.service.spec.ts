import { BadRequestException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { NotificationsService } from './notifications.service.js';
import { MASKED_VALUE } from '../../common/utils/sanitizer.util.js';
import type { NotificationsRepository } from './notifications.repository.js';
import type { TemplateService } from './templates/template.service.js';
import type { NotificationsQueueService } from './notifications.queue.js';
import type { SendNotificationDto } from './dto/send-notification.dto.js';

interface CreateNotificationInput {
  channel: NotificationChannel;
  recipientTarget: string;
  status?: NotificationStatus;
  title?: string;
  content: string;
  payload: { metadata: Record<string, unknown> };
  idempotencyKey: string;
  templateCode?: string | null;
}

interface Mocks {
  repository: {
    findByIdempotencyKey: jest.Mock;
    findByBaseIdempotencyKey: jest.Mock;
    create: jest.Mock<Promise<{ id: string }>, [CreateNotificationInput]>;
    findById: jest.Mock;
    findDeliveryLogs: jest.Mock;
  };
  templateService: { has: jest.Mock; render: jest.Mock };
  queue: { enqueue: jest.Mock };
}

function buildService(): { service: NotificationsService; mocks: Mocks } {
  const mocks: Mocks = {
    repository: {
      findByIdempotencyKey: jest.fn(),
      findByBaseIdempotencyKey: jest.fn().mockResolvedValue([]),
      create: jest.fn<Promise<{ id: string }>, [CreateNotificationInput]>(),
      findById: jest.fn(),
      findDeliveryLogs: jest.fn(),
    },
    templateService: { has: jest.fn(), render: jest.fn() },
    queue: { enqueue: jest.fn().mockResolvedValue(undefined) },
  };

  const service = new NotificationsService(
    mocks.repository as unknown as NotificationsRepository,
    mocks.templateService as unknown as TemplateService,
    mocks.queue as unknown as NotificationsQueueService,
  );

  return { service, mocks };
}

function baseDto(
  overrides: Partial<SendNotificationDto> = {},
): SendNotificationDto {
  return {
    idempotency_key: 'req-1',
    recipient_id: 'usr_1',
    channels: [NotificationChannel.SOCKET_IO],
    destination: { socket_room: 'room_usr_1' },
    content: { title: 'Hi', body: 'Hello' },
    ...overrides,
  };
}

describe('NotificationsService', () => {
  it('persists and enqueues a new notification', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByIdempotencyKey.mockResolvedValue(null);
    mocks.repository.create.mockResolvedValue({ id: 'n1' });

    const result = await service.send(baseDto());

    expect(result.notificationIds).toEqual(['n1']);
    expect(result.idempotent).toBe(false);
    expect(result.traceId).toBeDefined();
    expect(mocks.queue.enqueue).toHaveBeenCalledWith('n1');

    const created = mocks.repository.create.mock.calls[0][0] as {
      channel: string;
      recipientTarget: string;
      status?: string;
    };
    expect(created.channel).toBe(NotificationChannel.SOCKET_IO);
    expect(created.recipientTarget).toBe('room_usr_1');
  });

  it('returns the existing notification on an idempotency conflict', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByIdempotencyKey.mockResolvedValue({ id: 'existing' });

    const result = await service.send(baseDto());

    expect(result.notificationIds).toEqual(['existing']);
    expect(result.idempotent).toBe(true);
    expect(mocks.repository.create).not.toHaveBeenCalled();
    expect(mocks.queue.enqueue).not.toHaveBeenCalled();
  });

  it('returns all existing rows for a duplicate key even when the fan-out shape changed', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByBaseIdempotencyKey.mockResolvedValue([
      { id: 'existing-socket', traceId: 'original-trace' },
      { id: 'existing-email', traceId: 'original-trace' },
    ]);

    const result = await service.send(
      baseDto({
        idempotency_key: 'req-1',
        channels: [NotificationChannel.SOCKET_IO],
      }),
    );

    expect(mocks.repository.findByBaseIdempotencyKey).toHaveBeenCalledWith(
      'req-1',
    );
    expect(result.notificationIds).toEqual([
      'existing-socket',
      'existing-email',
    ]);
    expect(result.traceId).toBe('original-trace');
    expect(result.idempotent).toBe(true);
    expect(mocks.repository.create).not.toHaveBeenCalled();
    expect(mocks.queue.enqueue).not.toHaveBeenCalled();
  });

  it('resolves a concurrent insert race via the unique constraint', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByIdempotencyKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'raced' });
    mocks.repository.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    const result = await service.send(baseDto());

    expect(result.notificationIds).toEqual(['raced']);
    expect(result.idempotent).toBe(true);
    expect(mocks.queue.enqueue).not.toHaveBeenCalled();
  });

  it('rethrows unexpected persistence errors', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByIdempotencyKey.mockResolvedValue(null);
    mocks.repository.create.mockRejectedValue(new Error('db down'));

    await expect(service.send(baseDto())).rejects.toThrow('db down');
  });

  it('requires a recipient', async () => {
    const { service } = buildService();
    await expect(
      service.send(baseDto({ recipient_id: undefined })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a destination target for each channel', async () => {
    const { service } = buildService();
    await expect(
      service.send(
        baseDto({ destination: {}, channels: [NotificationChannel.EMAIL] }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires content body when no template is provided', async () => {
    const { service } = buildService();
    await expect(
      service.send(baseDto({ content: { title: 'only title' } })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('renders content from a template code', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByIdempotencyKey.mockResolvedValue(null);
    mocks.repository.create.mockResolvedValue({ id: 'n1' });
    mocks.templateService.has.mockReturnValue(true);
    mocks.templateService.render.mockReturnValue({
      title: 'OTP',
      body: 'code 123',
    });

    await service.send(
      baseDto({ template_code: 'otp', content: { body: undefined } }),
    );

    const created = mocks.repository.create.mock.calls[0][0] as {
      title: string;
      content: string;
    };
    expect(created.title).toBe('OTP');
    expect(created.content).toBe('code 123');
  });

  it('masks sensitive fields in the stored payload snapshot', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByIdempotencyKey.mockResolvedValue(null);
    mocks.repository.create.mockResolvedValue({ id: 'n1' });

    await service.send(
      baseDto({ metadata: { password: 'p@ss', source: 'billing' } }),
    );

    const created = mocks.repository.create.mock.calls[0][0] as {
      payload: { metadata: Record<string, unknown> };
    };
    expect(created.payload.metadata.password).toBe(MASKED_VALUE);
    expect(created.payload.metadata.source).toBe('billing');
  });

  it('creates one notification per recipient-channel pair for multicast', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByIdempotencyKey.mockResolvedValue(null);
    mocks.repository.create
      .mockResolvedValueOnce({ id: 'n1' })
      .mockResolvedValueOnce({ id: 'n2' })
      .mockResolvedValueOnce({ id: 'n3' })
      .mockResolvedValueOnce({ id: 'n4' });

    const result = await service.send(
      baseDto({
        recipient_id: undefined,
        channels: [NotificationChannel.SOCKET_IO, NotificationChannel.EMAIL],
        destination: { socket_room: 'room', email: 'a@b.com' },
        recipients: [{ recipient_id: 'u1' }, { recipient_id: 'u2' }],
      }),
    );

    expect(result.notificationIds).toEqual(['n1', 'n2', 'n3', 'n4']);
    expect(mocks.queue.enqueue).toHaveBeenCalledTimes(4);

    const keys = mocks.repository.create.mock.calls.map(
      (call) => (call[0] as { idempotencyKey: string }).idempotencyKey,
    );
    expect(new Set(keys).size).toBe(4);
    expect(keys.every((key) => key.startsWith('req-1::'))).toBe(true);
  });

  it('returns delivery logs for a notification', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findById.mockResolvedValue({ id: 'n1' });
    mocks.repository.findDeliveryLogs.mockResolvedValue([{ id: '1' }]);

    await expect(service.getLogs('n1')).resolves.toEqual([{ id: '1' }]);
    expect(mocks.repository.findById).toHaveBeenCalledWith('n1');
  });
});
