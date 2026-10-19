import { Module, forwardRef } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module.js'; 97b65b3 (feat(webhooks): dispatch auth and mfa lifecycle events via WebhookDispatcherService)
import { MfaController } from './mfa.controller.js';
import { MfaService } from './mfa.service.js';
import { MfaRepository } from './mfa.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, UsersModule, forwardRef(() => AuthModule), ClientsModule],
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    forwardRef(() => ClientsModule),
  ],
>>>>>>> 97b65b3 (feat(webhooks): dispatch auth and mfa lifecycle events via WebhookDispatcherService)
  controllers: [MfaController],
  providers: [MfaService, MfaRepository],
  exports: [MfaService],
})
export class MfaModule {}
