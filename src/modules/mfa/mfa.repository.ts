import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { MfaFactor } from '@prisma/client';

@Injectable()
export class MfaRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUser(userId: string, type = 'totp'): Promise<MfaFactor | null> {
    return this.prisma.mfaFactor.findFirst({ where: { userId, type } });
  }

  findActiveByUserAndType(userId: string, type: string) {
    return this.prisma.mfaFactor.findFirst({
      where: { userId, type, enabled: true },
    });
  }

  findAnyByUserAndType(userId: string, type: string) {
    return this.prisma.mfaFactor.findFirst({
      where: { userId, type },
    });
  }

  create(data: {
    userId: string;
    type: string;
    secret: string;
    enabled?: boolean;
    recoveryCodes?: string[];
  }): Promise<MfaFactor> {
    return this.prisma.mfaFactor.create({ data });
  }

  update(
    id: string,
    data: {
      secret?: string;
      enabled?: boolean;
      confirmedAt?: Date | null;
      recoveryCodes?: string[];
    },
  ): Promise<MfaFactor> {
    return this.prisma.mfaFactor.update({ where: { id }, data });
  }

  delete(id: string): Promise<MfaFactor> {
    return this.prisma.mfaFactor.delete({ where: { id } });
  }
}
