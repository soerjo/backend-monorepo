import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { loadJwtRsaKeypair } from '../../../common/utils/jwt-keypair.util.js';
import type { AuthUser } from '../../../common/interfaces/auth-user.interface.js';
import type { JwtPayload } from '../../../common/interfaces/jwt-payload.interface.js';

/**
 * Stateless RS256 access-token strategy. The JWT is verified locally against
 * the public key; roles/orgs come straight from the claims (no DB round-trip).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
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

  validate(payload: JwtPayload): AuthUser {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? null,
      roles: payload.roles ?? [],
      orgs: payload.orgs ?? [],
    };
  }
}
