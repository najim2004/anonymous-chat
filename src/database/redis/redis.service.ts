import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private static readonly url =
    process.env.REDIS_URL ?? 'redis://localhost:6379';

  private static readonly client = createClient({
    url: RedisService.url,
  }) as RedisClientType;

  private static readonly publisher = createClient({
    url: RedisService.url,
  }) as RedisClientType;

  private static readonly subscriber = createClient({
    url: RedisService.url,
  }) as RedisClientType;

  private static readonly adapterPublisher = createClient({
    url: RedisService.url,
  }) as RedisClientType;

  private static readonly adapterSubscriber = createClient({
    url: RedisService.url,
  }) as RedisClientType;

  private static connected = false;
  private static connecting: Promise<void> | null = null;
  private static closed = false;

  readonly client = RedisService.client;
  readonly publisher = RedisService.publisher;
  readonly subscriber = RedisService.subscriber;
  readonly adapterPublisher = RedisService.adapterPublisher;
  readonly adapterSubscriber = RedisService.adapterSubscriber;

  async onModuleInit() {
    await this.connect();
  }

  async connect() {
    if (RedisService.connected) {
      return;
    }

    if (!RedisService.connecting) {
      RedisService.connecting = Promise.all([
        this.client.connect(),
        this.publisher.connect(),
        this.subscriber.connect(),
        this.adapterPublisher.connect(),
        this.adapterSubscriber.connect(),
      ]).then(() => {
        RedisService.connected = true;
      });
    }

    await RedisService.connecting;
  }

  async onModuleDestroy() {
    if (RedisService.closed || !RedisService.connected) {
      return;
    }

    RedisService.closed = true;
    await Promise.allSettled([
      this.client.quit(),
      this.publisher.quit(),
      this.subscriber.quit(),
      this.adapterPublisher.quit(),
      this.adapterSubscriber.quit(),
    ]);
  }

  getAdapterPublisher(): RedisClientType {
    return this.adapterPublisher;
  }

  getAdapterSubscriber(): RedisClientType {
    return this.adapterSubscriber;
  }
}
