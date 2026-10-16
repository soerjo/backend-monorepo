import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
// import type { JwtPayload } from '../../../common/interfaces/jwt-payload.interface.js';
import { AuthService } from '../auth.service.js';
import { loadJwtRsaKeypair } from '../../../common/utils/jwt-keypair.util.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
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

  async validate(payload: { sub?: string; id?: string; email?: string }) {
    const userId = payload.sub ?? payload.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    const user = await this.authService.validateUserById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
