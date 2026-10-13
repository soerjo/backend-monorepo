import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'winston';

type RouteInfo = { path?: unknown };

export function getRouteLabel(req: Request): string {
  const route = req.route as RouteInfo | undefined;
  const path: unknown = route?.path;
  if (typeof path === 'string') {
    return path;
  }
  if (
    Array.isArray(path) &&
    path.length > 0 &&
    path.every((p) => typeof p === 'string')
  ) {
    return path.join('|');
  }
  return 'unmatched';
}

export function createRequestLoggingMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = performance.now();

    res.on('finish', () => {
      const durationMs = performance.now() - start;
      const route = getRouteLabel(req);
      logger.info(
        `${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs.toFixed(1)}ms`,
        {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          durationMs,
          route,
        },
      );
    });

    next();
  };
}
