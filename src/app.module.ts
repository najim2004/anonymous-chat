import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './database/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    // Infrastructure (database layer) — order matters: Redis must be first
    DatabaseModule,
    RedisModule,
    // Feature modules
    AuthModule,
    RoomsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
