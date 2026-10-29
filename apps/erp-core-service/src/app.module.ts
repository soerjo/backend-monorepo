import { Module, MiddlewareConsumer, NestModule, Inject } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { validate } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MetricsModule } from './modules/metrics/metrics.module.js';
import { MetricsService } from './modules/metrics/metrics.service.js';
import { AccountingModule } from './modules/accounting/accounting.module.js';
import { ProcurementModule } from './modules/procurement/procurement.module.js';
import { SalesModule } from './modules/sales/sales.module.js';
import { IntegrationModule } from './modules/integration/integration.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';
import { createRequestLoggingMiddleware } from './common/middleware/request-logging.middleware.js';
import { UmsJwksService } from './common/auth/ums-jwks.service.js';
import { JwtStrategy } from './common/strategies/jwt.strategy.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    MetricsModule,
    AccountingModule,
    ProcurementModule,
    SalesModule,
    IntegrationModule,
  ],
  providers: [
    UmsJwksService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly metricsService: MetricsService,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(createRequestLoggingMiddleware(this.logger, this.metricsService)).forRoutes('*');
  }
}
