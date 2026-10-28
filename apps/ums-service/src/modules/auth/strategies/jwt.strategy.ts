import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { loadJwtRsaKeypair } from '../../../common/utils/jwt-keypair.util.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { $Enums } from '@prisma/client';
import type { AuthUser } from '../../../common/interfaces/auth-user.interface.js';
import type { JwtPayload } from '../../../common/interfaces/jwt-payload.interface.js';

/**
 * Stateless RS256 access-token strategy with 30s TTL in-memory cache for user ACTIVE check.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private userCache = new Map<string, { active: boolean; timestamp: number }>();
  private readonly CACHE_TTL_MS = 30 * 1000;

  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const { publicKey } = loadJwtRsaKeypair({
      privateKey: configService.get<string>('UMS_JWT_PRIVATE_KEY'),
      privateKeyPath: configService.get<string>('UMS_JWT_PRIVATE_KEY_PATH'),
    });

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: publicKey,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }

    const now = Date.now();
    const cached = this.userCache.get(payload.sub);
    if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      if (!cached.active) {
        throw new UnauthorizedException('user is not active');
      }
    } else {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { status: true },
      });
      const isActive = user?.status === $Enums.UserStatus.ACTIVE;
      this.userCache.set(payload.sub, { active: isActive, timestamp: now });
      if (!isActive) {
        throw new UnauthorizedException('user is not active');
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? null,
      roles: payload.roles ?? [],
      orgs: payload.orgs ?? [],
      perms: payload.perms ?? [],
    };
  }
}
