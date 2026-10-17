import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { RedisService } from '../../redis/redis.service.js';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const latencyMs = await this.redisService.ping();
      return this.getStatus(key, true, {
        latencyMs: Math.round(latencyMs),
      });
    } catch (error) {
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
