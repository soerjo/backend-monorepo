import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Session } from '@prisma/client';
import { sha256Hex } from '../../common/utils/hash.util.js';
import { parseCookieHeader } from '../../common/utils/cookie.util.js';
import {
  parseUserAgent,
  ParsedUserAgent,
} from '../../common/utils/user-agent.util.js';
import { SessionsRepository } from './sessions.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import { REFRESH_COOKIE_NAME } from '../auth/auth.constants.js';

/**
 * Public session-object shape per frozen contract epic 002.
 * Chain fields (refreshHash, replacedByHash, family) are STRUCTURALLY excluded
 * by whitelist mapping — they can never leak.
 */
export interface SessionClientDto {
  browser: string;
  os: string;
  deviceType: string;
}

export interface SessionDto {
  id: string;
  current: boolean;
  client: SessionClientDto;
  ip: string | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface AdminSessionDto {
  id: string;
  client: SessionClientDto;
  ip: string | null;
  createdAt: Date;
  expiresAt: Date;
}

export const SESSION_NOT_FOUND_MESSAGE = 'Session not found';

@Injectable()
export class SessionsService {
  constructor(
    private sessionsRepository: SessionsRepository,
    private usersRepository: UsersRepository,
    private configService: ConfigService,
  ) {}

  private toSessionDto(row: Session, currentHash: string | null): SessionDto {
    const client: ParsedUserAgent = parseUserAgent(row.userAgent);
    return {
      id: row.id,
      current: currentHash !== null && row.refreshHash === currentHash,
      client,
      ip: row.ip,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }

  private toAdminSessionDto(row: Session): AdminSessionDto {
    const client: ParsedUserAgent = parseUserAgent(row.userAgent);
    return {
      id: row.id,
      client,
      ip: row.ip,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }

  private extractRefreshHashes(cookieHeader: string | undefined): string[] {
    if (!cookieHeader) return [];
    const cookies = parseCookieHeader(cookieHeader);
    const raw = cookies[REFRESH_COOKIE_NAME];
    return raw ? [sha256Hex(raw)] : [];
  }

  /** Lists the caller's active sessions, newest first, exactly one current:true. */
  async listOwn(
    userId: string,
    cookieHeader: string | undefined,
  ): Promise<SessionDto[]> {
    const [rows, currentHash] = await Promise.all([
      this.sessionsRepository.findActiveByUser(userId),
      this.sessionsRepository.findCurrentHash(
        userId,
        this.extractRefreshHashes(cookieHeader),
      ),
    ]);
    return rows.map((row) => this.toSessionDto(row, currentHash));
  }

  /**
   * Revokes the session's entire family. 404 with ONE shared message for
   * "does not exist" and "not owned by caller" — ids of other users cannot
   * be probed.
   */
  async revokeOwn(id: string, userId: string): Promise<void> {
    const revoked = await this.sessionsRepository.revokeFamilyBySessionId({
      id,
      userId,
    });
    if (revoked === null) {
      throw new NotFoundException(SESSION_NOT_FOUND_MESSAGE);
    }
  }

  /** Admin: active sessions of any user, same shape without the current flag. */
  async listForUser(targetUserId: string): Promise<AdminSessionDto[]> {
    await this.ensureUserExists(targetUserId);
    const rows = await this.sessionsRepository.findActiveByUser(targetUserId);
    return rows.map((row) => this.toAdminSessionDto(row));
  }

  /** Admin: revoke ALL of the user's sessions; 404 when the user does not exist. */
  async revokeAllForUser(targetUserId: string): Promise<{ revoked: number }> {
    await this.ensureUserExists(targetUserId);
    const revoked =
      await this.sessionsRepository.revokeAllActiveByUser(targetUserId);
    return { revoked };
  }

  private async ensureUserExists(userId: string): Promise<void> {
    try {
      await this.usersRepository.findById(userId);
    } catch {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
  }
}
