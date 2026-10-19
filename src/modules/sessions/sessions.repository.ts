import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Repository owning every Prisma interaction for the session-manager feature.
 * Error semantics (shared 404, ownership) are decided by the service layer;
 * revocation always happens at FAMILY level (contract rule 1).
 */
@Injectable()
export class SessionsRepository {
  constructor(private prisma: PrismaService) {}

  async findActiveByUser(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Raw row for ownership checks; the service maps absence to the shared 404. */
  async findById(id: string) {
    return this.prisma.session.findUnique({ where: { id } });
  }

  /**
   * Revokes the whole FAMILY of the session identified by (id, userId).
   * Returns the revoked count, or null when the session does not exist or is
   * not owned by the user — indistinguishable on purpose (contract rule).
   */
  async revokeFamilyBySessionId(params: {
    id: string;
    userId: string;
  }): Promise<number | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: params.id },
    });

    if (!session || session.userId !== params.userId) {
      return null;
    }

    const result = await this.prisma.session.updateMany({
      where: { family: session.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count;
  }

  async countActiveByUser(userId: string): Promise<number> {
    return this.prisma.session.count({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async revokeAllActiveByUser(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  /**
   * Resolves the caller's current session: among the provided refresh hashes,
   * which ones are active rows of this user. The first match is the current one.
   */
  async findCurrentHash(
    userId: string,
    candidateHashes: string[],
  ): Promise<string | null> {
    if (candidateHashes.length === 0) return null;
    const row = await this.prisma.session.findFirst({
      where: {
        userId,
        refreshHash: { in: candidateHashes },
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { refreshHash: true },
    });
    return row?.refreshHash ?? null;
  }

  /** Used by the mapper path through Prisma types; kept explicit for clarity. */
  transaction(tx: Prisma.TransactionClient) {
    return tx;
  }
}
