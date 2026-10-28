import { parseUserAgent } from './user-agent.util.js';

describe('parseUserAgent', () => {
  it('parses modern Chrome on Windows 11-ish UA as desktop', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
    expect(parseUserAgent(ua)).toEqual({
      browser: 'Chrome 141',
      os: 'Windows 10/11',
      deviceType: 'desktop',
    });
  });

  it('parses Edge before Chrome', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0';
    const parsed = parseUserAgent(ua);
    expect(parsed.browser).toBe('Edge 141');
  });

  it('parses Firefox on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0';
    expect(parseUserAgent(ua)).toEqual({
      browser: 'Firefox 141',
      os: 'macOS',
      deviceType: 'desktop',
    });
  });

  it('parses Safari on iPhone as mobile', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    expect(parseUserAgent(ua)).toEqual({
      browser: 'Safari 18',
      os: 'iOS',
      deviceType: 'mobile',
    });
  });

  it('parses Android Chrome as mobile', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
    const parsed = parseUserAgent(ua);
    expect(parsed.os).toBe('Android');
    expect(parsed.browser).toBe('Chrome 141');
    expect(parsed.deviceType).toBe('mobile');
  });

  it('parses an iPad as tablet', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    expect(parseUserAgent(ua).deviceType).toBe('tablet');
  });

  it('returns all-unknown for an unrecognized UA instead of throwing', () => {
    expect(parseUserAgent('weird-crawler/1.0')).toEqual({
      browser: 'unknown',
      os: 'unknown',
      deviceType: 'unknown',
    });
  });

  it('returns all-unknown for null, undefined, or empty UA', () => {
    expect(parseUserAgent(null)).toEqual({
      browser: 'unknown',
      os: 'unknown',
      deviceType: 'unknown',
    });
    expect(parseUserAgent('')).toEqual({
      browser: 'unknown',
      os: 'unknown',
      deviceType: 'unknown',
    });
    expect(parseUserAgent(undefined)).toEqual({
      browser: 'unknown',
      os: 'unknown',
      deviceType: 'unknown',
    });
  });
});
