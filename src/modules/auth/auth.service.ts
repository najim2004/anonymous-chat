import { HttpStatus, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CreateAuthDto } from './dto/create-auth.dto';
import { DatabaseService } from '../../core/database/database.service';
import { users } from '../../../drizzle/schema';
import { RedisService } from '../../core/redis/redis.service';
import { ApiException } from '../../common/errors/api.exception';
import { SessionUser } from './auth.types';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  /** Session TTL: 24 hours */
  private readonly sessionTtlSeconds = 60 * 60 * 24;

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async login(createAuthDto: CreateAuthDto) {
    const username = this.validateUsername(createAuthDto.username);
    let user = await this.findUserByUsername(username);

    if (!user) {
      const [created] = await this.database.db
        .insert(users)
        .values({
          id: this.makeId('usr'),
          username,
        })
        .returning();
      user = created;
    }

    const sessionUser: SessionUser = {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt.toISOString(),
    };

    const sessionToken = this.makeOpaqueSessionToken();

    // Store in Redis with TTL so token can be invalidated server-side
    await this.redis.client.set(
      this.sessionKey(sessionToken),
      JSON.stringify(sessionUser),
      { EX: this.sessionTtlSeconds },
    );

    return {
      sessionToken,
      user: sessionUser,
    };
  }

  async getSessionUser(token: string): Promise<SessionUser | null> {
    if (!token) {
      return null;
    }

    // Resolve session state from Redis (single source of truth)
    const value = await this.redis.client.get(this.sessionKey(token));
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as SessionUser;
    } catch {
      return null;
    }
  }

  private async findUserByUsername(username: string) {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user;
  }

  private validateUsername(username: unknown) {
    if (typeof username !== 'string') {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'username must be between 2 and 24 characters',
      );
    }

    const trimmed = username.trim();
    if (!/^[A-Za-z0-9_]{2,24}$/.test(trimmed)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'username must be between 2 and 24 characters',
      );
    }

    return trimmed;
  }

  private sessionKey(token: string) {
    return `session:${token}`;
  }

  private makeOpaqueSessionToken() {
    return randomBytes(32).toString('hex');
  }

  private makeId(prefix: string) {
    return `${prefix}_${randomBytes(6).toString('hex')}`;
  }
}
