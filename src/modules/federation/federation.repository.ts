import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

const PUBLIC_SELECT = {
  id: true,
  name: true,
  issuer: true,
  clientId: true,
  scopes: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class FederationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveById(id: string) {
    return this.prisma.identityProvider.findFirst({
      where: { id, active: true },
    });
  }

  list() {
    return this.prisma.identityProvider.findMany({
      select: PUBLIC_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: {
    name: string;
    issuer: string;
    clientId: string;
    clientSecretEnc: string;
    scopes: string[];
    active: boolean;
  }) {
    return this.prisma.identityProvider.create({ data });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.identityProvider.update({
      where: { id },
      data,
      select: PUBLIC_SELECT,
    });
  }

  remove(id: string) {
    return this.prisma.identityProvider.delete({ where: { id } });
  }
}
