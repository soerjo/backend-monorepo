import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MetricsModule } from './modules/metrics/metrics.module.js';
import { JwtAuthModule } from './common/auth/jwt-auth.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { ContentTypesModule } from './modules/content-types/content-types.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { TagsModule } from './modules/tags/tags.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { DeliveryModule } from './modules/delivery/delivery.module.js';
import { loggerConfig } from './config/logger.config.js';
import { validate } from './config/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    WinstonModule.forRoot(loggerConfig),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    PrismaModule,
    JwtAuthModule,
    HealthModule,
    MetricsModule,
    ContentTypesModule,
    ContentModule,
    CategoriesModule,
    TagsModule,
    MediaModule,
    DeliveryModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
