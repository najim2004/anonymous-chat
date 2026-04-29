import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { RedisService } from '../../core/redis/redis.service';
import { RoomsService } from '../rooms/rooms.service';

type SocketState = {
  roomId: string;
  username: string;
};

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly roomsService: RoomsService,
    private readonly redis: RedisService,
  ) {}

  async afterInit() {
    await this.redis.subscriber.subscribe('chat:events', (message) => {
      this.handleChatEvent(message);
    });
  }

  async handleConnection(socket: Socket) {
    const token = this.readQuery(socket, 'token');
    const roomId = this.readQuery(socket, 'roomId');

    if (!token) {
      return this.disconnectWithError(
        socket,
        401,
        'Missing or expired session token',
      );
    }

    const user = await this.authService.getSessionUser(token);
    if (!user) {
      return this.disconnectWithError(
        socket,
        401,
        'Missing or expired session token',
      );
    }

    if (!roomId || !(await this.roomsService.roomExists(roomId))) {
      return this.disconnectWithError(
        socket,
        404,
        `Room with id ${roomId} does not exist`,
      );
    }

    await socket.join(roomId);
    await this.trackJoin(socket.id, roomId, user.username);

    const activeUsers = await this.getActiveUsers(roomId);
    socket.emit('room:joined', { activeUsers });
    socket.to(roomId).emit('room:user_joined', {
      username: user.username,
      activeUsers,
    });
  }

  async handleDisconnect(socket: Socket) {
    await this.leaveRoom(socket);
  }

  @SubscribeMessage('room:leave')
  async handleLeave(socket: Socket) {
    await this.leaveRoom(socket);
    socket.disconnect(true);
  }

  private handleChatEvent(raw: string) {
    const event = JSON.parse(raw) as {
      type: string;
      payload: Record<string, unknown>;
    };

    if (event.type === 'message:new') {
      const roomId = event.payload.roomId as string;
      this.server.local.to(roomId).emit('message:new', event.payload.message);
      return;
    }

    if (event.type === 'room:deleted') {
      const roomId = event.payload.roomId as string;
      this.server.local.to(roomId).emit('room:deleted', { roomId });
    }
  }

  private async trackJoin(socketId: string, roomId: string, username: string) {
    const socketKey = this.socketKey(socketId);
    const userSocketsKey = this.userSocketsKey(roomId, username);

    await this.redis.client
      .multi()
      .hSet(socketKey, { roomId, username })
      .expire(socketKey, 60 * 60 * 24)
      .sAdd(userSocketsKey, socketId)
      .expire(userSocketsKey, 60 * 60 * 24)
      .sAdd(this.activeUsersKey(roomId), username)
      .exec();
  }

  private async leaveRoom(socket: Socket) {
    const state = await this.getSocketState(socket.id);
    if (!state) {
      return;
    }

    const userSocketsKey = this.userSocketsKey(state.roomId, state.username);
    await this.redis.client.sRem(userSocketsKey, socket.id);
    const remainingSockets = await this.redis.client.sCard(userSocketsKey);

    await socket.leave(state.roomId);
    await this.redis.client.del(this.socketKey(socket.id));

    if (remainingSockets > 0) {
      return;
    }

    await this.redis.client
      .multi()
      .sRem(this.activeUsersKey(state.roomId), state.username)
      .del(userSocketsKey)
      .exec();

    const activeUsers = await this.getActiveUsers(state.roomId);
    socket.to(state.roomId).emit('room:user_left', {
      username: state.username,
      activeUsers,
    });
  }

  private async getSocketState(socketId: string): Promise<SocketState | null> {
    const state = await this.redis.client.hGetAll(this.socketKey(socketId));
    if (!state.roomId || !state.username) {
      return null;
    }

    return {
      roomId: state.roomId,
      username: state.username,
    };
  }

  private async getActiveUsers(roomId: string) {
    const users = await this.redis.client.sMembers(this.activeUsersKey(roomId));
    return users.sort((a, b) => a.localeCompare(b));
  }

  private disconnectWithError(socket: Socket, code: number, message: string) {
    socket.emit('error', { code, message });
    socket.disconnect(true);
  }

  private readQuery(socket: Socket, key: string) {
    const value = socket.handshake.query[key];
    return Array.isArray(value) ? value[0] : value;
  }

  private activeUsersKey(roomId: string) {
    return `room:${roomId}:active_users`;
  }

  private userSocketsKey(roomId: string, username: string) {
    return `room:${roomId}:user:${username}:sockets`;
  }

  private socketKey(socketId: string) {
    return `socket:${socketId}`;
  }
}
