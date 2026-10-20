import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId?: string;
  roles?: string[];
  permissions?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const publicKeyPath = configService.get<string>('UMS_JWT_PUBLIC_KEY_PATH');
    let secretOrKey = configService.get<string>('UMS_JWT_PUBLIC_KEY');

    if (!secretOrKey && publicKeyPath && existsSync(publicKeyPath)) {
      secretOrKey = readFileSync(publicKeyPath, 'utf8');
    }

    if (!secretOrKey) {
      secretOrKey = configService.get<string>('JWT_ACCESS_SECRET') || 'dev-secret-key';
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      organizationId: payload.organizationId,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
    };
  }
}
