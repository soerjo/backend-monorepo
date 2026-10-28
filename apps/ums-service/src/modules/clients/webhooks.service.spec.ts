import { Test, TestingModule } from '@nestjs/testing';
import { JwtKeysService } from '../auth/jwt-keys.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { hashSecret } from './client-secrets.util.js';
import { WebhookDispatcherService } from './webhook-dispatcher.service.js';
import { WebhookSecretService } from './webhook-secret.service.js';
import {
  decryptWebhookSecret,
  deriveWebhookEncryptionKey,
} from './webhook-secret.util.js';
import { WebhooksRepository } from './webhooks.repository.js';
import { WebhooksService } from './webhooks.service.js';

const TEST_KEY_MATERIAL = 'unit-test-key-material';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: {
    webhookEndpoint: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
  };
  let dispatcher: { dispatch: jest.Mock };

  beforeEach(async () => {
    prisma = {
      webhookEndpoint: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };
    dispatcher = { dispatch: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        WebhooksRepository,
        { provide: PrismaService, useValue: prisma },
        {
          provide: WebhookSecretService,
          useValue: new WebhookSecretService({
            privateKey: TEST_KEY_MATERIAL,
          } as JwtKeysService),
        },
        { provide: WebhookDispatcherService, useValue: dispatcher },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  it('returns the raw secret once and stores hash plus ciphertext', async () => {
    type CreatedData = {
      url: string;
      events: string[];
      active: boolean;
      secretHash: string;
      secretEnc: string;
    };
    let captured: CreatedData | undefined;

    prisma.webhookEndpoint.create.mockImplementation(
      (args: { data: CreatedData }) => {
        captured = args.data;
        return Promise.resolve({
          id: 'endpoint-1',
          url: args.data.url,
          events: args.data.events,
          active: args.data.active,
          createdAt: new Date(),
        });
      },
    );

    const result = await service.create({
      url: 'https://consumer.example.com/hooks',
      events: ['user.created'],
    });

    expect(captured).toBeDefined();
    expect(captured?.secretHash).toBe(hashSecret(result.secret));
    expect(
      decryptWebhookSecret(
        captured?.secretEnc ?? '',
        deriveWebhookEncryptionKey(TEST_KEY_MATERIAL),
      ),
    ).toBe(result.secret);
    expect(result).not.toHaveProperty('secretHash');
    expect(result).not.toHaveProperty('secretEnc');
  });

  it('sends a webhook.test event to a single endpoint', async () => {
    prisma.webhookEndpoint.findUnique.mockResolvedValue({
      id: 'endpoint-1',
      url: 'https://consumer.example.com/hooks',
      events: ['user.created'],
      active: true,
      createdAt: new Date(),
    });

    await service.sendTest('endpoint-1');

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'webhook.test',
      expect.objectContaining({ endpointId: 'endpoint-1' }),
      { endpointIds: ['endpoint-1'] },
    );
  });

  it('throws when testing an unknown endpoint', async () => {
    prisma.webhookEndpoint.findUnique.mockResolvedValue(null);
    await expect(service.sendTest('missing')).rejects.toThrow('not found');
  });
});
