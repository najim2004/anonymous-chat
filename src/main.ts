import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { RedisAdapter } from './core/websockets/redis.adapter';
import { RedisService } from './core/redis/redis.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const redis = app.get(RedisService);

  await redis.connect();

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useWebSocketAdapter(new RedisAdapter(app, redis));

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
