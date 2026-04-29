import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { RedisIoAdapter } from './modules/chat/redis-io.adapter';
import { RedisService } from './database/redis/redis.service';

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
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useWebSocketAdapter(new RedisIoAdapter(app, redis));

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
