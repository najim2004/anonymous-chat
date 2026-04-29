import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiException } from '../errors/api.exception';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof ApiException) {
      return response.status(exception.getStatus()).json({
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'object' &&
        payload !== null &&
        'message' in payload &&
        typeof payload.message === 'string'
          ? payload.message
          : exception.message;

      return response.status(status).json({
        success: false,
        error: {
          code: status === 401 ? 'UNAUTHORIZED' : 'VALIDATION_ERROR',
          message,
        },
      });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
      },
    });
  }
}
