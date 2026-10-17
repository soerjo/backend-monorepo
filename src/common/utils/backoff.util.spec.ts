import {
  CUSTOM_BACKOFF_TYPE,
  MAX_ATTEMPTS,
  RETRY_BACKOFF_MS,
  getBackoffDelayMs,
  getRetryOptions,
} from './backoff.util.js';

describe('backoff configuration', () => {
  it('uses three attempts with the 2s/8s/30s schedule', () => {
    expect(MAX_ATTEMPTS).toBe(3);
    expect([...RETRY_BACKOFF_MS]).toEqual([2000, 8000, 30000]);
  });

  it('maps retry attempts to exponential delays', () => {
    expect(getBackoffDelayMs(1)).toBe(2000);
    expect(getBackoffDelayMs(2)).toBe(8000);
    expect(getBackoffDelayMs(3)).toBe(30000);
  });

  it('clamps out-of-range attempts', () => {
    expect(getBackoffDelayMs(0)).toBe(2000);
    expect(getBackoffDelayMs(10)).toBe(30000);
  });

  it('returns job options with a custom backoff', () => {
    expect(getRetryOptions()).toEqual({
      attempts: 3,
      backoff: { type: CUSTOM_BACKOFF_TYPE },
    });
  });
});
