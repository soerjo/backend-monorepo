import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'winston';

const SKIPPED_PATHS = ['/metrics', '/health'];

type RouteInfo = { path?: unknown };

export interface IMetricsRecorder {
  recordRequest(
    method: string,
    route: string,
    status: number,
    durationSeconds: number,
  ): void;
}

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

export function createRequestLoggingMiddleware(
  logger: Logger,
  metricsService?: IMetricsRecorder,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SKIPPED_PATHS.includes(req.path)) {
      next();
      return;
    }

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
      if (metricsService) {
        metricsService.recordRequest(
          req.method,
          route,
          res.statusCode,
          durationMs / 1000,
        );
      }
    });

    next();
  };
}
