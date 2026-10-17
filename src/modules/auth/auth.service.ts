import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { $Enums } from '@prisma/client';
import type { User } from '@prisma/client';
import { UsersRepository } from '../users/users.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { parseDurationToSeconds } from '../../common/utils/token-expiry.util.js';
import {
  hashPassword,
  verifyPassword,
} from '../../common/utils/password.util.js';
import {
  generateOpaqueToken,
  sha256Hex,
} from '../../common/utils/hash.util.js';
import { JWT_AZP } from './auth.constants.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import type { RegisterDto } from './dto/register.dto.js';

export interface RequestMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  status: $Enums.UserStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private usersRepository: UsersRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  private get accessTokenTtlSeconds(): number {
    return parseDurationToSeconds(
      this.configService.get<string>('JWT_ACCESS_EXPIRATION') ?? '15m',
    );
  }

  get refreshTokenTtlSeconds(): number {
    return parseDurationToSeconds(
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '30d',
    );
  }

  private async loadRoles(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { name: true } } },
    });
    return rows.map((row) => row.role.name);
  }

  private async loadOrgs(userId: string): Promise<string[]> {
    const rows = await this.prisma.orgMember.findMany({
      where: { userId },
      select: { organization: { select: { name: true } } },
    });
    return rows.map((row) => row.organization.name);
  }

  private async loadPerms(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: {
            rolePermissions: {
              select: {
                permission: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    const permSet = new Set<string>();
    for (const ur of rows) {
      for (const rp of ur.role.rolePermissions) {
        permSet.add(rp.permission.name);
      }
    }
    return Array.from(permSet).sort();
  }

  private async toAuthUser(user: User): Promise<AuthUser> {
    const [roles, orgs, perms] = await Promise.all([
      this.loadRoles(user.id),
      this.loadOrgs(user.id),
      this.loadPerms(user.id),
    ]);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
      orgs,
      perms,
    };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  /**
   * Signs a stateless RS256 access token carrying roles/orgs/perms as claims so
   * downstream services can authorize without calling UMS.
   */
  buildAccessToken(user: AuthUser): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      orgs: user.orgs,
      perms: user.perms,
      azp: JWT_AZP,
    });
  }

  private async createSession(
    userId: string,
    family: string,
    meta: RequestMeta,
  ): Promise<{ refreshToken: string; refreshHash: string; expiresAt: Date }> {
    const refreshToken = generateOpaqueToken();
    const refreshHash = sha256Hex(refreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlSeconds * 1000);

    await this.prisma.session.create({
      data: {
        userId,
        refreshHash,
        family,
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
        expiresAt,
      },
    });

    return { refreshToken, refreshHash, expiresAt };
  }

  private async revokeFamily(family: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user || user.status !== $Enums.UserStatus.ACTIVE) {
      return null;
    }

    const passwordMatches = await verifyPassword(user.passwordHash, password);
    if (!passwordMatches) {
      return null;
    }

    return this.toAuthUser(user);
  }

  async validateUserById(id: string): Promise<AuthUser | null> {
    const user = await this.usersRepository.findById(id).catch(() => null);
    if (!user || user.status !== $Enums.UserStatus.ACTIVE) {
      return null;
    }
    return this.toAuthUser(user);
  }

  async register(dto: RegisterDto): Promise<PublicUser> {
    const existingUser = await this.usersRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const passwordHash = await hashPassword(dto.password);

    // v1 has no SMTP: registration is auto-verified.
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name ?? null,
        status: $Enums.UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

    return this.toPublicUser(user);
  }

  async login(user: AuthUser, meta: RequestMeta = {}): Promise<IssuedTokens> {
    const { refreshToken } = await this.createSession(
      user.id,
      randomUUID(),
      meta,
    );

    return {
      accessToken: this.buildAccessToken(user),
      refreshToken,
      user,
    };
  }

  async refresh(
    rawToken: string,
    meta: RequestMeta = {},
  ): Promise<IssuedTokens> {
    const refreshHash = sha256Hex(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshHash },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection: a rotated or revoked token presented again means the
    // token was stolen — burn every session in the family.
    if (session.revokedAt || session.replacedByHash) {
      await this.revokeFamily(session.family);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.usersRepository
      .findById(session.userId)
      .catch(() => null);
    if (!user || user.status !== $Enums.UserStatus.ACTIVE) {
      await this.revokeFamily(session.family);
      throw new UnauthorizedException('User is not active');
    }

    const authUser = await this.toAuthUser(user);
    const rotated = await this.createSession(user.id, session.family, meta);

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        replacedByHash: rotated.refreshHash,
      },
    });

    return {
      accessToken: this.buildAccessToken(authUser),
      refreshToken: rotated.refreshToken,
      user: authUser,
    };
  }

  async logout(rawToken: string): Promise<void> {
    const refreshHash = sha256Hex(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshHash },
    });

    if (session && !session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.usersRepository.findById(userId).catch(() => null);
    if (!user || user.status !== $Enums.UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }
    return this.toAuthUser(user);
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  get accessTokenExpiresInSeconds(): number {
    return this.accessTokenTtlSeconds;
  }
}
