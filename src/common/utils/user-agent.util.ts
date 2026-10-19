/**
 * Server-side userAgent parsing (contract epic 002 rule 3-4). Dependency-free:
 * one definition consumed by every response, and an unrecognizable UA yields
 * "unknown" fields — never an error.
 */

export interface ParsedUserAgent {
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
}

const UNKNOWN: ParsedUserAgent = {
  browser: 'unknown',
  os: 'unknown',
  deviceType: 'unknown',
};

const BROWSER_PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  // Order matters: Edg(e) before Chrome, OPR before Chrome.
  [/Edg(?:e|A|iOS)?\/([\d.]+)/, (m) => `Edge ${major(m[1])}`],
  [/OPR\/([\d.]+)/, (m) => `Opera ${major(m[1])}`],
  [/Firefox\/([\d.]+)/, (m) => `Firefox ${major(m[1])}`],
  [/FxiOS\/([\d.]+)/, (m) => `Firefox ${major(m[1])}`],
  [/CriOS\/([\d.]+)/, (m) => `Chrome ${major(m[1])}`],
  [/Chrome\/([\d.]+)/, (m) => `Chrome ${major(m[1])}`],
  [/Version\/([\d.]+).*Safari/, (m) => `Safari ${major(m[1])}`],
  [/Safari\/([\d.]+)/, (m) => `Safari ${major(m[1])}`],
];

const OS_PATTERNS: Array<[RegExp, string]> = [
  [/Windows NT 10\.0/, 'Windows 10/11'],
  [/Windows NT 6\.3/, 'Windows 8.1'],
  [/Windows NT 6\.2/, 'Windows 8'],
  [/Windows NT 6\.1/, 'Windows 7'],
  [/Mac OS X ([\d_]+)/, 'macOS'],
  [/Android ([\d.]+)/, 'Android'],
  [/iPhone OS ([\d_]+)/, 'iOS'],
  [/iPad.*OS ([\d_]+)/, 'iPadOS'],
  [/Ubuntu/, 'Linux'],
  [/Linux/, 'Linux'],
];

function major(version: string | undefined): string {
  if (!version) return '';
  const dot = version.indexOf('.');
  return dot === -1 ? version : version.slice(0, dot);
}

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua || !ua.trim()) {
    return UNKNOWN;
  }

  let browser = 'unknown';
  for (const [pattern, build] of BROWSER_PATTERNS) {
    const match = ua.match(pattern);
    if (match) {
      browser = build(match);
      break;
    }
  }

  let os = 'unknown';
  for (const [pattern, name] of OS_PATTERNS) {
    if (pattern.test(ua)) {
      os = name;
      break;
    }
  }

  let deviceType: ParsedUserAgent['deviceType'] = 'unknown';
  if (
    /iPad|Tablet|PlayBook|Silk/.test(ua) ||
    (/Android/.test(ua) && !/Mobile/.test(ua))
  ) {
    deviceType = 'tablet';
  } else if (/Mobi|iPhone|Android.*Mobile|Windows Phone/.test(ua)) {
    deviceType = 'mobile';
  } else if (/Windows|Macintosh|Mac OS X|Linux/.test(ua)) {
    deviceType = 'desktop';
  }

  return { browser, os, deviceType };
}
