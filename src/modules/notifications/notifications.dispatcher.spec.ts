import {
  DeliveryLogStatus,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import { NotificationsDispatcher } from './notifications.dispatcher.js';
import { MASKED_VALUE } from '../../common/utils/sanitizer.util.js';
import type { NotificationsRepository } from './notifications.repository.js';
import type { ChannelRegistry } from './channels/channel-registry.js';
import type { MetricsService } from '../metrics/metrics.service.js';

interface DeliveryLogInput {
  status: DeliveryLogStatus;
  attempt: number;
  latencyMs: number;
  providerResponse: Record<string, unknown>;
}

interface Mocks {
  repository: {
    findById: jest.Mock;
    updateStatus: jest.Mock<
      Promise<void>,
      [string, { status: NotificationStatus }]
    >;
    createDeliveryLog: jest.Mock<Promise<void>, [DeliveryLogInput]>;
  };
  registry: { get: jest.Mock };
  metrics: { recordDelivery: jest.Mock };
  send: jest.Mock;
}

function buildDispatcher(): {
  dispatcher: NotificationsDispatcher;
  mocks: Mocks;
} {
  const send = jest.fn();
  const mocks: Mocks = {
    repository: {
      findById: jest.fn().mockResolvedValue({
        id: 'n1',
        channel: NotificationChannel.TELEGRAM,
        recipientId: 'u1',
        recipientTarget: 'chat',
        title: 't',
        content: 'c',
        payload: { source: 'billing' },
        templateCode: null,
      }),
      updateStatus: jest
        .fn<Promise<void>, [string, { status: NotificationStatus }]>()
        .mockResolvedValue(undefined),
      createDeliveryLog: jest
        .fn<Promise<void>, [DeliveryLogInput]>()
        .mockResolvedValue(undefined),
    },
    registry: {
      get: jest.fn().mockReturnValue({
        channel: NotificationChannel.TELEGRAM,
        send,
      }),
    },
    metrics: { recordDelivery: jest.fn() },
    send,
  };

  const dispatcher = new NotificationsDispatcher(
    mocks.repository as unknown as NotificationsRepository,
    mocks.registry as unknown as ChannelRegistry,
    mocks.metrics as unknown as MetricsService,
  );

  return { dispatcher, mocks };
}

describe('NotificationsDispatcher', () => {
  it('transitions PENDING -> PROCESSING -> SENT and logs success', async () => {
    const { dispatcher, mocks } = buildDispatcher();
    mocks.send.mockResolvedValue({
      ok: true,
      response: { message_id: 1, access_token: 'secret' },
      latencyMs: 12,
    });

    await dispatcher.dispatch({
      notificationId: 'n1',
      attempt: 1,
      maxAttempts: 3,
    });

    const statuses = mocks.repository.updateStatus.mock.calls.map(
      (call) => call[1].status,
    );
    expect(statuses).toEqual([
      NotificationStatus.PROCESSING,
      NotificationStatus.SENT,
    ]);

    expect(mocks.repository.createDeliveryLog).toHaveBeenCalledTimes(1);
    const log = mocks.repository.createDeliveryLog.mock.calls[0][0];
    expect(log.status).toBe(DeliveryLogStatus.SUCCESS);
    expect(log.attempt).toBe(1);
    expect(log.latencyMs).toBe(12);
    expect(log.providerResponse.access_token).toBe(MASKED_VALUE);
    expect(mocks.metrics.recordDelivery).toHaveBeenCalledWith(
      NotificationChannel.TELEGRAM,
      true,
    );
  });

  it('marks RETRY and rethrows when attempts remain', async () => {
    const { dispatcher, mocks } = buildDispatcher();
    mocks.send.mockRejectedValue(new Error('provider down'));

    await expect(
      dispatcher.dispatch({
        notificationId: 'n1',
        attempt: 1,
        maxAttempts: 3,
      }),
    ).rejects.toThrow('provider down');

    const lastStatus = (
      mocks.repository.updateStatus.mock.calls.at(-1)?.[1] as {
        status: NotificationStatus;
      }
    ).status;
    expect(lastStatus).toBe(NotificationStatus.RETRY);

    const log = mocks.repository.createDeliveryLog.mock.calls[0][0] as {
      status: DeliveryLogStatus;
      providerResponse: Record<string, unknown>;
    };
    expect(log.status).toBe(DeliveryLogStatus.FAILED);
    expect(log.providerResponse.error).toBe('provider down');
    expect(mocks.metrics.recordDelivery).toHaveBeenCalledWith(
      NotificationChannel.TELEGRAM,
      false,
    );
  });

  it('marks FAILED on the final attempt', async () => {
    const { dispatcher, mocks } = buildDispatcher();
    mocks.send.mockRejectedValue(new Error('still down'));

    await expect(
      dispatcher.dispatch({
        notificationId: 'n1',
        attempt: 3,
        maxAttempts: 3,
      }),
    ).rejects.toThrow('still down');

    const lastStatus = (
      mocks.repository.updateStatus.mock.calls.at(-1)?.[1] as {
        status: NotificationStatus;
      }
    ).status;
    expect(lastStatus).toBe(NotificationStatus.FAILED);
  });
});
