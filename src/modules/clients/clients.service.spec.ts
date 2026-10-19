import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { hashSecret } from './client-secrets.util.js';
import { ClientsRepository } from './clients.repository.js';
import { ClientsService } from './clients.service.js';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: {
    apiClient: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      apiClient: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        ClientsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  it('returns the raw client secret once and persists only its hash', async () => {
    type CreatedData = {
      name: string;
      clientId: string;
      clientSecretHash: string;
      scopes: string[];
      rateLimitPerMinute: number;
    };
    let captured: CreatedData | undefined;

    prisma.apiClient.create.mockImplementation(
      (args: { data: CreatedData }) => {
        captured = args.data;
        return Promise.resolve({
          id: 'client-1',
          name: args.data.name,
          clientId: args.data.clientId,
          scopes: args.data.scopes,
          rateLimitPerMinute: args.data.rateLimitPerMinute,
          lastUsedAt: null,
          active: true,
          createdAt: new Date(),
        });
      },
    );

    const result = await service.create({ name: 'billing-worker' });

    expect(captured).toBeDefined();
    expect(captured?.clientId).toMatch(/^svc_[0-9a-f]{24}$/);
    expect(captured?.clientSecretHash).toBe(hashSecret(result.clientSecret));
    expect(result.clientSecret).not.toBe(captured?.clientSecretHash);
  });

  it('applies default scopes and rate limit', async () => {
    let captured: { scopes: string[]; rateLimitPerMinute: number } | undefined;

    prisma.apiClient.create.mockImplementation(
      (args: { data: { scopes: string[]; rateLimitPerMinute: number } }) => {
        captured = args.data;
        return Promise.resolve({
          id: 'client-1',
          name: 'worker',
          clientId: 'svc_1',
          scopes: args.data.scopes,
          rateLimitPerMinute: args.data.rateLimitPerMinute,
          lastUsedAt: null,
          active: true,
          createdAt: new Date(),
        });
      },
    );

    await service.create({ name: 'worker' });

    expect(captured?.scopes).toEqual([]);
    expect(captured?.rateLimitPerMinute).toBe(60);
  });

  it('revokes a client by setting active to false', async () => {
    prisma.apiClient.findUnique.mockResolvedValue({ id: 'client-1' });
    prisma.apiClient.update.mockResolvedValue({
      id: 'client-1',
      active: false,
    });

    const result = await service.revoke('client-1');

    expect(prisma.apiClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'client-1' },
        data: { active: false },
      }),
    );
    expect(result).toEqual({ id: 'client-1', active: false });
  });

  it('throws when revoking an unknown client', async () => {
    prisma.apiClient.findUnique.mockResolvedValue(null);
    await expect(service.revoke('missing')).rejects.toThrow('not found');
  });
});
