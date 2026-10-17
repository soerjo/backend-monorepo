export const MAX_ATTEMPTS = 3;

export const RETRY_BACKOFF_MS = [2000, 8000, 30000] as const;

export const CUSTOM_BACKOFF_TYPE = 'custom';

export interface RetryOptions {
  attempts: number;
  backoff: { type: string };
}

export function getBackoffDelayMs(attemptsMade: number): number {
  const index = Math.min(
    Math.max(attemptsMade - 1, 0),
    RETRY_BACKOFF_MS.length - 1,
  );
  return RETRY_BACKOFF_MS[index];
}

export function getRetryOptions(): RetryOptions {
  return {
    attempts: MAX_ATTEMPTS,
    backoff: { type: CUSTOM_BACKOFF_TYPE },
  };
}
