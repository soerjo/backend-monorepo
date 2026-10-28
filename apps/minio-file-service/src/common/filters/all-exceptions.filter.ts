import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';

interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof AppError) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resp = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(resp.message)) {
          message = 'Validation failed';
          details = resp.message;
        } else {
          message = (resp.message as string) ?? message;
        }
      }
      code = this.resolveCode(status, message);
    } else {
      if (exception instanceof Error) {
        this.logger.error(exception.message, exception.stack);
      }
    }

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${code} - ${JSON.stringify(message)}`,
    );

    const error: ErrorBody['error'] = { code, message };
    if (details !== undefined) {
      error.details = details;
    }

    response.status(status).json({ success: false, error });
  }

  private resolveCode(status: HttpStatus, message: string): string {
    if (status === HttpStatus.BAD_REQUEST) {
      return 'VALIDATION_ERROR';
    }
    if (status === HttpStatus.UNAUTHORIZED) {
      return /expired/i.test(message) ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED';
    }
    if (status === HttpStatus.FORBIDDEN) {
      return 'FORBIDDEN';
    }
    if (status === HttpStatus.NOT_FOUND) {
      return 'NOT_FOUND';
    }
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
      return 'FILE_TOO_LARGE';
    }
    if (status === HttpStatus.UNSUPPORTED_MEDIA_TYPE) {
      return 'UNSUPPORTED_MEDIA_TYPE';
    }
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return 'RATE_LIMITED';
    }
    return 'INTERNAL_ERROR';
  }
}
