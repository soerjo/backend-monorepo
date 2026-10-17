export type ParsedRedisConnection = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
};

export function parseRedisUrl(url: string): ParsedRedisConnection {
  const parsed = new URL(url);

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error(`Invalid Redis URL protocol: ${parsed.protocol}`);
  }

  const options: ParsedRedisConnection = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
  };

  if (parsed.username) {
    options.username = decodeURIComponent(parsed.username);
  }

  if (parsed.password) {
    options.password = decodeURIComponent(parsed.password);
  }

  const database = parsed.pathname.replace(/^\//, '');
  if (database) {
    options.db = Number(database);
  }

  if (parsed.protocol === 'rediss:') {
    options.tls = {};
  }

  return options;
}
