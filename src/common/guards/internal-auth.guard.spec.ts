import { extractBearerToken, safeTokenEquals } from './internal-auth.guard.js';

describe('extractBearerToken', () => {
  it('extracts a bearer token', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
  });

  it('is case-insensitive on the scheme', () => {
    expect(extractBearerToken('bearer abc123')).toBe('abc123');
  });

  it('returns null for a missing header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null for malformed headers', () => {
    expect(extractBearerToken('abc123')).toBeNull();
    expect(extractBearerToken('Basic abc123')).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull();
  });
});

describe('safeTokenEquals', () => {
  it('returns true for equal tokens', () => {
    expect(safeTokenEquals('token', 'token')).toBe(true);
  });

  it('returns false for different tokens', () => {
    expect(safeTokenEquals('token', 'other')).toBe(false);
  });

  it('returns false when lengths differ without throwing', () => {
    expect(safeTokenEquals('token', 'longer-token')).toBe(false);
  });
});
