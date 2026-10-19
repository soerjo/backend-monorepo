import { Injectable } from '@nestjs/common';
import { JwtKeysService } from '../auth/jwt-keys.service.js';
import { hashSecret } from './client-secrets.util.js';
import {
  decryptWebhookSecret,
  deriveWebhookEncryptionKey,
  encryptWebhookSecret,
} from './webhook-secret.util.js';

export interface ProtectedWebhookSecret {
  secretHash: string;
  secretEnc: string;
}

@Injectable()
export class WebhookSecretService {
  private readonly encryptionKey: Buffer;

  constructor(jwtKeysService: JwtKeysService) {
    this.encryptionKey = deriveWebhookEncryptionKey(jwtKeysService.privateKey);
  }

  protect(secret: string): ProtectedWebhookSecret {
    return {
      secretHash: hashSecret(secret),
      secretEnc: encryptWebhookSecret(secret, this.encryptionKey),
    };
  }

  reveal(secretEnc: string): string {
    return decryptWebhookSecret(secretEnc, this.encryptionKey);
  }
}
