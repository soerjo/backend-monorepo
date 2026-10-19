import { Injectable } from '@nestjs/common';

const WINDOW_MS = 60_000;
const MAX_TRACKED_CLIENTS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

@Injectable()
export class ClientRateLimiterService {
  private readonly windows = new Map<string, RateLimitWindow>();

  consume(
    clientId: string,
    limitPerMinute: number,
    now = Date.now(),
  ): RateLimitResult {
    const current = this.windows.get(clientId);

    if (!current || now >= current.resetAt) {
      this.windows.set(clientId, { count: 1, resetAt: now + WINDOW_MS });
      this.prune(now);
      return {
        allowed: true,
        remaining: Math.max(limitPerMinute - 1, 0),
        retryAfterMs: 0,
      };
    }

    if (current.count >= limitPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: current.resetAt - now,
      };
    }

    current.count += 1;
    return {
      allowed: true,
      remaining: Math.max(limitPerMinute - current.count, 0),
      retryAfterMs: 0,
    };
  }

  private prune(now: number): void {
    if (this.windows.size <= MAX_TRACKED_CLIENTS) {
      return;
    }
    for (const [clientId, window] of this.windows) {
      if (now >= window.resetAt) {
        this.windows.delete(clientId);
      }
    }
  }
}
