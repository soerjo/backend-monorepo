import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { JWT_ISSUER } from '../auth/auth.constants.js';
import { AuthModule } from '../auth/auth.module.js';
import { JwtKeysService } from '../auth/jwt-keys.service.js';
import { ClientRateLimiterService } from './client-rate-limiter.service.js';
import { ClientsController } from './clients.controller.js';
import { ClientsRepository } from './clients.repository.js';
import { ClientsService } from './clients.service.js';
import { M2M_TOKEN_TTL_SECONDS } from './clients.constants.js';
import { OauthController } from './oauth.controller.js';
import { OauthTokenService } from './oauth-token.service.js';
import { WebhookDispatcherService } from './webhook-dispatcher.service.js';
import { WebhookSecretService } from './webhook-secret.service.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksRepository } from './webhooks.repository.js';
import { WebhooksService } from './webhooks.service.js';

@Module({
  imports: [
    AuthModule,
    JwtModule.registerAsync({
      imports: [AuthModule],
      inject: [JwtKeysService],
      useFactory: (jwtKeysService: JwtKeysService): JwtModuleOptions => ({
        privateKey: jwtKeysService.privateKey,
        signOptions: {
          algorithm: 'RS256',
          expiresIn: M2M_TOKEN_TTL_SECONDS,
          issuer: JWT_ISSUER,
          keyid: jwtKeysService.kid,
        },
      }),
    }),
  ],
  controllers: [ClientsController, OauthController, WebhooksController],
  providers: [
    ClientsRepository,
    ClientsService,
    ClientRateLimiterService,
    OauthTokenService,
    WebhooksRepository,
    WebhooksService,
    WebhookSecretService,
    WebhookDispatcherService,
  ],
  exports: [WebhookDispatcherService],
})
export class ClientsModule {}
