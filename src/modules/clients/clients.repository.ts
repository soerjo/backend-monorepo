import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

const API_CLIENT_SELECT = {
  id: true,
  name: true,
  clientId: true,
  scopes: true,
  rateLimitPerMinute: true,
  lastUsedAt: true,
  active: true,
  createdAt: true,
} as const;

@Injectable()
export class ClientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.apiClient.findMany({
      select: API_CLIENT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const client = await this.prisma.apiClient.findUnique({
      where: { id },
      select: API_CLIENT_SELECT,
    });
    if (!client) {
      throw new NotFoundException(`API client with id ${id} not found`);
    }
    return client;
  }

  findByClientId(clientId: string) {
    return this.prisma.apiClient.findUnique({ where: { clientId } });
  }

  create(data: {
    name: string;
    clientId: string;
    clientSecretHash: string;
    scopes: string[];
    rateLimitPerMinute: number;
  }) {
    return this.prisma.apiClient.create({ data, select: API_CLIENT_SELECT });
  }

  async update(
    id: string,
    data: { name?: string; scopes?: string[]; rateLimitPerMinute?: number },
  ) {
    await this.findById(id);
    return this.prisma.apiClient.update({
      where: { id },
      data,
      select: API_CLIENT_SELECT,
    });
  }

  async revoke(id: string) {
    await this.findById(id);
    return this.prisma.apiClient.update({
      where: { id },
      data: { active: false },
      select: API_CLIENT_SELECT,
    });
  }

  touchLastUsed(id: string, lastUsedAt: Date) {
    return this.prisma.apiClient.update({
      where: { id },
      data: { lastUsedAt },
    });
  }
}
