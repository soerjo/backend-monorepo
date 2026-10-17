import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { loadUmsPublicKey } from '../utils/ums-jwt-key.util.js';
import { AuthUser } from '../interfaces/auth-user.interface.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const publicKey = loadUmsPublicKey(
      configService.get<string>('UMS_JWT_PUBLIC_KEY'),
      configService.get<string>('UMS_JWT_PUBLIC_KEY_PATH'),
    );

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });
  }

  validate(payload: {
    sub: string;
    email: string;
    roles?: string[];
    orgs?: string[];
  }): AuthUser {
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      orgs: payload.orgs,
    };
  }
}
