import { Injectable } from '@nestjs/common';
import { Prisma, AuthTokenType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Repository owning every Prisma interaction with the AuthToken table.
 * The service layer decides error semantics (e.g. anti-enumeration);
 * this layer only reads and writes rows.
 */
@Injectable()
export class AuthTokensRepository {
  constructor(private prisma: PrismaService) {}

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return this.prisma.authToken.create({
      data: {
        userId,
        type: AuthTokenType.PASSWORD_RESET,
        tokenHash,
        expiresAt,
      },
      select: { id: true },
    });
  }

  async createEmailVerifyToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return this.prisma.authToken.create({
      data: {
        userId,
        type: AuthTokenType.EMAIL_VERIFY,
        tokenHash,
        expiresAt,
      },
      select: { id: true },
    });
  }

  /**
   * Fetches a usable EMAIL_VERIFY token by hash. A token is usable only when
   * it is unexpired and unused; invalid, expired, and used tokens are
   * intentionally indistinguishable at this layer.
   */
  async findValidEmailVerifyToken(tokenHash: string) {
    return this.prisma.authToken.findFirst({
      where: {
        type: AuthTokenType.EMAIL_VERIFY,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Atomically consumes a valid EMAIL_VERIFY token: marks it used and fills
   * users.emailVerifiedAt. The conditional update (emailVerifiedAt: null in
   * the where clause) guarantees an already-verified email is never reset —
   * even under a race, the verified truth stays untouched.
   */
  async consumeEmailVerifyToken(params: {
    tokenId: string;
    userId: string;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.authToken.update({
        where: { id: params.tokenId },
        data: { usedAt: new Date() },
      });

      const result = await tx.user.updateMany({
        where: { id: params.userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });

      return result.count > 0;
    });
  }

  /**
   * Fetches a usable PASSWORD_RESET token by hash. A token is usable only
   * when it is unexpired and unused; invalid, expired, and used tokens are
   * intentionally indistinguishable at this layer.
   */
  async findValidPasswordResetToken(tokenHash: string) {
    return this.prisma.authToken.findFirst({
      where: {
        type: AuthTokenType.PASSWORD_RESET,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Atomically consumes a valid PASSWORD_RESET token: marks it used, replaces
   * the user's password hash (argon2id), and revokes every active session of
   * the user. A single transaction guarantees the three mutations cannot
   * partially apply.
   */
  async consumePasswordResetToken(params: {
    tokenId: string;
    newPasswordHash: string;
    userId: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.authToken.update({
        where: { id: params.tokenId },
        data: { usedAt: new Date() },
      });

      await tx.user.update({
        where: { id: params.userId },
        data: { passwordHash: params.newPasswordHash },
      });

      await tx.session.updateMany({
        where: { userId: params.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}
