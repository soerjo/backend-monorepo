import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export function extractBearerToken(
  authorization: string | undefined,
): string | null {
  if (!authorization) {
    return null;
  }
  const [scheme, token] = authorization.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
}

export function safeTokenEquals(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = this.configService.get<string>('INTERNAL_API_TOKEN');
    const provided = extractBearerToken(request.headers.authorization);

    if (!expected || !provided || !safeTokenEquals(expected, provided)) {
      throw new UnauthorizedException('Invalid internal API token');
    }

    return true;
  }
}
