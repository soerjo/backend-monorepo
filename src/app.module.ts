import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InvoicesModule } from './modules/invoices/invoices.module.js';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';
import { OutboxModule } from './modules/outbox/outbox.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    HealthModule,
    InvoicesModule,
    WebhooksModule,
    OutboxModule,
    ReportsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
