import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Every error leaves the API as `{ statusCode, message, code? }` with `message` a
 * single readable string, which is what the frontend shows in its toasts.
 * Validation errors arrive as an array and are joined; unexpected errors are
 * logged in full and answered with a generic message so internals never leak.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const raw =
        typeof body === 'string'
          ? body
          : (body as { message?: string | string[] }).message;
      const message = Array.isArray(raw)
        ? raw.join('. ')
        : (raw ?? exception.message);
      // A machine-readable code when the app needs one (e.g. MFA_REQUIRED).
      const code =
        typeof body === 'object' && body && 'code' in body
          ? (body as { code?: unknown }).code
          : undefined;
      res
        .status(status)
        .json(
          typeof code === 'string'
            ? { statusCode: status, message, code }
            : { statusCode: status, message },
        );
      return;
    }

    this.logger.error(describe(exception));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Une erreur interne est survenue',
    });
  }
}

/**
 * A loggable summary of anything thrown. Plain objects are never logged
 * whole: SDKs (Cloudinary's, for one) reject with objects that carry the
 * request options, credentials included.
 */
export function describe(exception: unknown): string {
  if (exception instanceof Error) return exception.stack ?? exception.message;
  if (exception && typeof exception === 'object') {
    const record = exception as {
      message?: unknown;
      http_code?: unknown;
      error?: { message?: unknown; http_code?: unknown };
    };
    const message = record.error?.message ?? record.message;
    const code = record.error?.http_code ?? record.http_code;
    const status =
      typeof code === 'number' || typeof code === 'string'
        ? ` (HTTP ${code})`
        : '';
    return `Non-Error thrown${status}: ${
      typeof message === 'string' ? message : 'no message'
    }`;
  }
  return `Non-Error thrown: ${String(exception)}`;
}
