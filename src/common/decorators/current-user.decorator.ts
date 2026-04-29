import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionUser } from '../../modules/auth/auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const request = ctx.switchToHttp().getRequest<{ user: SessionUser }>();
    return request.user;
  },
);
