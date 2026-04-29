import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
  ) {
    super({ code, message }, status);
  }
}
