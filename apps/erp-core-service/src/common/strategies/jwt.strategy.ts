import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UmsJwksService } from '../auth/ums-jwks.service.js';
import { AuthUser } from '../interfaces/auth-user.interface.js';

export interface UmsJwtPayload {
  sub: string;
  email: string;
  roles?: string[];
  permissions?: string[];
  orgs?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly umsJwksService: UmsJwksService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKeyProvider: (
        _request: unknown,
        rawJwtToken: string,
        done: (err: unknown, secretOrKey?: string | Buffer) => void,
      ) => {
        let kid: string | undefined;
        try {
          const header = JSON.parse(
            Buffer.from(rawJwtToken.split('.')[0], 'base64').toString('utf8'),
          ) as { kid?: string };
          kid = header.kid;
        } catch {
          // fallback to first key if header parsing fails
        }

        this.umsJwksService
          .getVerificationKeys()
          .then((keys) => {
            const pem = kid && keys[kid] ? keys[kid] : Object.values(keys)[0];
            if (!pem) {
              done(new Error('No UMS verification keys available'), undefined);
              return;
            }
            done(null, pem);
          })
          .catch((err: unknown) => {
            done(err, undefined);
          });
      },
    });
  }

  validate(payload: UmsJwtPayload): AuthUser {
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
    };
  }
}
