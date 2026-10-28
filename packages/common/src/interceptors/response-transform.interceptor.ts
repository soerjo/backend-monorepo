import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';

export interface StandardResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
}

// Kept for backward compatibility with existing imports
export type Response<T> = StandardResponse<T>;

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>();
    return next.handle().pipe(
      map((data: T) => ({
        statusCode: response.statusCode,
        message: 'Success',
        data,
        timestamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}
