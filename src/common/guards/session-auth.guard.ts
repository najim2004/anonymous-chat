import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ApiException } from '../errors/api.exception';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: unknown;
    }>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHORIZED',
        'Missing or expired session token',
      );
    }

    const token = header.slice('Bearer '.length).trim();
    const user = await this.authService.getSessionUser(token);

    if (!user) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHORIZED',
        'Missing or expired session token',
      );
    }

    request.user = user;
    return true;
  }
}
