import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server, ServerOptions } from 'socket.io';
import { RedisService } from '../redis/redis.service';

export class RedisAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly redis: RedisService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: process.env.CORS_ORIGIN ?? '*',
        credentials: true,
      },
    }) as Server;

    server.adapter(
      createAdapter(
        this.redis.getAdapterPublisher(),
        this.redis.getAdapterSubscriber(),
      ),
    );

    return server;
  }
}
