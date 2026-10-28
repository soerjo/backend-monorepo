import { ClientRateLimiterService } from './client-rate-limiter.service.js';

describe('ClientRateLimiterService', () => {
  let limiter: ClientRateLimiterService;

  beforeEach(() => {
    limiter = new ClientRateLimiterService();
  });

  it('allows requests up to the limit and blocks the next one', () => {
    expect(limiter.consume('svc_a', 3).allowed).toBe(true);
    expect(limiter.consume('svc_a', 3).allowed).toBe(true);
    expect(limiter.consume('svc_a', 3).allowed).toBe(true);

    const blocked = limiter.consume('svc_a', 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets once the one-minute window elapses', () => {
    const start = 1_000_000;
    expect(limiter.consume('svc_b', 1, start).allowed).toBe(true);
    expect(limiter.consume('svc_b', 1, start + 1).allowed).toBe(false);
    expect(limiter.consume('svc_b', 1, start + 60_000).allowed).toBe(true);
  });

  it('tracks clients independently', () => {
    expect(limiter.consume('svc_c', 1).allowed).toBe(true);
    expect(limiter.consume('svc_c', 1).allowed).toBe(false);
    expect(limiter.consume('svc_d', 1).allowed).toBe(true);
  });

  it('reports the remaining budget', () => {
    expect(limiter.consume('svc_e', 5).remaining).toBe(4);
    expect(limiter.consume('svc_e', 5).remaining).toBe(3);
  });
});
