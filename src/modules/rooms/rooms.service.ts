import { HttpStatus, Injectable } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { DatabaseService } from '../../core/database/database.service';
import { messages, rooms, users } from '../../../drizzle/schema';
import { RedisService } from '../../core/redis/redis.service';
import { SessionUser } from '../auth/auth.types';
import { ApiException } from '../../common/errors/api.exception';

@Injectable()
export class RoomsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async create(createRoomDto: CreateRoomDto, user: SessionUser) {
    const name = this.validateRoomName(createRoomDto.name);
    const existing = await this.findRoomByName(name);

    if (existing) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'ROOM_NAME_TAKEN',
        'A room with this name already exists',
      );
    }

    const [room] = await this.database.db
      .insert(rooms)
      .values({
        id: this.makeId('room'),
        name,
        createdById: user.id,
      })
      .returning();

    return {
      id: room.id,
      name: room.name,
      createdBy: user.username,
      createdAt: room.createdAt.toISOString(),
    };
  }

  async findAll() {
    const roomRows = await this.database.db
      .select({
        id: rooms.id,
        name: rooms.name,
        createdBy: users.username,
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .innerJoin(users, eq(rooms.createdById, users.id))
      .orderBy(desc(rooms.createdAt));

    const mapped = await Promise.all(
      roomRows.map(async (room) => ({
        ...room,
        activeUsers: await this.getActiveUserCount(room.id),
        createdAt: room.createdAt.toISOString(),
      })),
    );

    return { rooms: mapped };
  }

  async findOne(id: string) {
    const room = await this.getRoomDetails(id);
    return {
      ...room,
      activeUsers: await this.getActiveUserCount(id),
    };
  }

  async remove(id: string, user: SessionUser) {
    const room = await this.getRoomRecord(id);

    if (room.createdById !== user.id) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        'Only the room creator can delete this room',
      );
    }

    await this.publishChatEvent('room:deleted', { roomId: id });
    await this.database.db.delete(rooms).where(eq(rooms.id, id));
    await this.redis.client.del(this.activeUsersKey(id));

    return { deleted: true };
  }

  async listMessages(id: string, limitQuery?: string, before?: string) {
    await this.getRoomRecord(id);
    const limit = this.normalizeLimit(limitQuery);
    let cursorCreatedAt: Date | null = null;

    if (before) {
      const [cursor] = await this.database.db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(and(eq(messages.roomId, id), eq(messages.id, before)))
        .limit(1);
      cursorCreatedAt = cursor?.createdAt ?? null;
    }

    const where = cursorCreatedAt
      ? and(eq(messages.roomId, id), lt(messages.createdAt, cursorCreatedAt))
      : eq(messages.roomId, id);

    const rows = await this.database.db
      .select({
        id: messages.id,
        roomId: messages.roomId,
        username: users.username,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(where)
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const page = rows.slice(0, limit).map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    }));

    return {
      messages: page,
      hasMore: rows.length > limit,
      nextCursor:
        rows.length > limit && page.length ? page[page.length - 1].id : null,
    };
  }

  async createMessage(id: string, dto: CreateMessageDto, user: SessionUser) {
    await this.getRoomRecord(id);
    const content = this.validateMessageContent(dto.content);

    const [message] = await this.database.db
      .insert(messages)
      .values({
        id: this.makeId('msg'),
        roomId: id,
        userId: user.id,
        content,
      })
      .returning();

    const response = {
      id: message.id,
      roomId: message.roomId,
      username: user.username,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };

    await this.publishChatEvent('message:new', {
      roomId: response.roomId,
      message: {
        id: response.id,
        username: response.username,
        content: response.content,
        createdAt: response.createdAt,
      },
    });

    return response;
  }

  async roomExists(id: string) {
    const [room] = await this.database.db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    return Boolean(room);
  }

  private async getRoomDetails(id: string) {
    const [room] = await this.database.db
      .select({
        id: rooms.id,
        name: rooms.name,
        createdBy: users.username,
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .innerJoin(users, eq(rooms.createdById, users.id))
      .where(eq(rooms.id, id))
      .limit(1);

    if (!room) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'ROOM_NOT_FOUND',
        `Room with id ${id} does not exist`,
      );
    }

    return {
      ...room,
      createdAt: room.createdAt.toISOString(),
    };
  }

  private async getRoomRecord(id: string) {
    const [room] = await this.database.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    if (!room) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'ROOM_NOT_FOUND',
        `Room with id ${id} does not exist`,
      );
    }

    return room;
  }

  private async findRoomByName(name: string) {
    const [room] = await this.database.db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.name, name))
      .limit(1);

    return room;
  }

  private validateRoomName(name: unknown) {
    if (typeof name !== 'string' || !/^[A-Za-z0-9-]{3,32}$/.test(name.trim())) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'name must be between 3 and 32 characters and contain only letters, numbers, and hyphens',
      );
    }

    return name.trim();
  }

  private validateMessageContent(content: unknown) {
    if (typeof content !== 'string') {
      throw new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_ERROR',
        'Message content is required',
      );
    }

    const trimmed = content.trim();
    if (!trimmed) {
      throw new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'MESSAGE_EMPTY',
        'Message content must not be empty',
      );
    }

    if (trimmed.length > 1000) {
      throw new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'MESSAGE_TOO_LONG',
        'Message content must not exceed 1000 characters',
      );
    }

    return trimmed;
  }

  private normalizeLimit(limitQuery?: string) {
    const parsed = Number(limitQuery ?? 50);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return 50;
    }

    return Math.min(parsed, 100);
  }

  private async getActiveUserCount(roomId: string) {
    return this.redis.client.sCard(this.activeUsersKey(roomId));
  }

  private activeUsersKey(roomId: string) {
    return `room:${roomId}:active_users`;
  }

  private async publishChatEvent(type: string, payload: unknown) {
    await this.redis.publisher.publish(
      'chat:events',
      JSON.stringify({ type, payload }),
    );
  }

  private makeId(prefix: string) {
    return `${prefix}_${randomBytes(6).toString('hex')}`;
  }
}
