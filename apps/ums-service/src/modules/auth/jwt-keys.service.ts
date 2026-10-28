import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  loadJwtRsaKeypair,
  type JwtRsaKeypair,
} from '../../common/utils/jwt-keypair.util.js';
import {
  publicKeyToJwk,
  type RsaPublicJwk,
} from '../../common/utils/jwk.util.js';

/**
 * Owns the RS256 keypair derived from the environment. Exposes the public key
 * and its JWK so the JWKS endpoint and token signing always agree on `kid`.
 */
@Injectable()
export class JwtKeysService {
  private readonly keypair: JwtRsaKeypair;

  constructor(configService: ConfigService) {
    this.keypair = loadJwtRsaKeypair({
      privateKey: configService.get<string>('UMS_JWT_PRIVATE_KEY'),
      privateKeyPath: configService.get<string>('UMS_JWT_PRIVATE_KEY_PATH'),
    });
  }

  get privateKey(): string {
    return this.keypair.privateKey;
  }

  get publicKey(): string {
    return this.keypair.publicKey;
  }

  get jwk(): RsaPublicJwk {
    return publicKeyToJwk(this.keypair.publicKey);
  }

  get kid(): string {
    return this.jwk.kid;
  }
}
