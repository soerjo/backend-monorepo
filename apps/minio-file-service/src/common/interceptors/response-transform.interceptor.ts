import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator.js';

export interface Envelope<T> {
  success: true;
  data: T | null;
  message?: string;
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<
  T,
  Envelope<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Envelope<T>> {
    const message = this.reflector.getAllAndOverride<string | undefined>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((data: T) => ({
        success: true as const,
        data: data ?? null,
        ...(message ? { message } : {}),
      })),
    );
  }
}
