import { createHmac } from 'node:crypto';
import type { WebhookEndpoint } from '@prisma/client';
import { WebhookDispatcherService } from './webhook-dispatcher.service.js';
import { WebhookSecretService } from './webhook-secret.service.js';
import { WebhooksRepository } from './webhooks.repository.js';

describe('WebhookDispatcherService', () => {
  const endpoint: WebhookEndpoint = {
    id: 'endpoint-1',
    url: 'https://consumer.example.com/hooks',
    secretHash: 'hash',
    secretEnc: 'encrypted',
    events: ['user.created'],
    active: true,
    createdAt: new Date(),
  };

  let dispatcher: WebhookDispatcherService;
  let repository: {
    findActiveByEvent: jest.Mock;
    findActiveByIds: jest.Mock;
    createDelivery: jest.Mock;
  };
  let secrets: { reveal: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    repository = {
      findActiveByEvent: jest.fn(),
      findActiveByIds: jest.fn(),
      createDelivery: jest.fn().mockResolvedValue({}),
    };
    secrets = { reveal: jest.fn().mockReturnValue('raw-webhook-secret') };
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    dispatcher = new WebhookDispatcherService(
      repository as unknown as WebhooksRepository,
      secrets as unknown as WebhookSecretService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('signs the raw body with HMAC-SHA256 of the endpoint secret', async () => {
    repository.findActiveByEvent.mockResolvedValue([endpoint]);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const results = await dispatcher.dispatch(
      'user.created',
      { userId: 'u1' },
      { retryDelayMs: 1 },
    );

    const calls = fetchMock.mock.calls as [string, RequestInit][];
    const [url, init] = calls[0];
    const body = init.body as string;

    expect(url).toBe(endpoint.url);
    expect(init.headers).toEqual(
      expect.objectContaining({
        'x-signature': createHmac('sha256', 'raw-webhook-secret')
          .update(body)
          .digest('hex'),
      }),
    );
    expect(JSON.parse(body)).toMatchObject({
      event: 'user.created',
      data: { userId: 'u1' },
    });
    expect(results).toEqual([
      {
        endpointId: 'endpoint-1',
        event: 'user.created',
        attempt: 1,
        status: 'SUCCESS',
        responseCode: 200,
        latencyMs: expect.any(Number) as number,
      },
    ]);
    expect(repository.createDelivery).toHaveBeenCalledTimes(1);
  });

  it('retries up to three times and records one delivery per attempt', async () => {
    repository.findActiveByEvent.mockResolvedValue([endpoint]);
    fetchMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ ok: false, status: 503 });

    const results = await dispatcher.dispatch(
      'user.created',
      {},
      { retryDelayMs: 1 },
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(results.map((result) => result.attempt)).toEqual([1, 2, 3]);
    expect(results.map((result) => result.status)).toEqual([
      'FAILED',
      'FAILED',
      'FAILED',
    ]);
    expect(repository.createDelivery).toHaveBeenCalledTimes(3);
    expect(results[0].responseCode).toBeNull();
    expect(results[2].responseCode).toBe(503);
  });

  it('stops retrying after the first successful attempt', async () => {
    repository.findActiveByEvent.mockResolvedValue([endpoint]);
    fetchMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ ok: true, status: 204 });

    const results = await dispatcher.dispatch(
      'user.created',
      {},
      { retryDelayMs: 1 },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results.map((result) => result.status)).toEqual([
      'FAILED',
      'SUCCESS',
    ]);
  });

  it('does not call fetch when no endpoint subscribes', async () => {
    repository.findActiveByEvent.mockResolvedValue([]);

    const results = await dispatcher.dispatch('nobody.listens', {});

    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('targets explicit endpoint ids when provided', async () => {
    repository.findActiveByIds.mockResolvedValue([endpoint]);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await dispatcher.dispatch(
      'webhook.test',
      { endpointId: 'endpoint-1' },
      { endpointIds: ['endpoint-1'], retryDelayMs: 1 },
    );

    expect(repository.findActiveByIds).toHaveBeenCalledWith(['endpoint-1']);
    expect(repository.findActiveByEvent).not.toHaveBeenCalled();
  });
});
