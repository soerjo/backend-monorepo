import { parseRedisUrl } from './redis-url.util.js';

describe('parseRedisUrl', () => {
  it('parses host and port', () => {
    expect(parseRedisUrl('redis://localhost:6380')).toEqual({
      host: 'localhost',
      port: 6380,
    });
  });

  it('defaults the port to 6379', () => {
    expect(parseRedisUrl('redis://redis')).toEqual({
      host: 'redis',
      port: 6379,
    });
  });

  it('parses username, password and database', () => {
    expect(parseRedisUrl('redis://user:pass@redis:6379/2')).toEqual({
      host: 'redis',
      port: 6379,
      username: 'user',
      password: 'pass',
      db: 2,
    });
  });

  it('enables tls for rediss URLs', () => {
    const result = parseRedisUrl('rediss://secure:6379');
    expect(result.tls).toEqual({});
  });

  it('rejects unsupported protocols', () => {
    expect(() => parseRedisUrl('http://localhost:6379')).toThrow(
      'Invalid Redis URL protocol',
    );
  });
});
