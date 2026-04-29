import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { SessionUser } from '../auth/auth.types';

@Controller('rooms')
@UseGuards(SessionAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  @Post()
  create(
    @Body() createRoomDto: CreateRoomDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.roomsService.create(createRoomDto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.roomsService.remove(id, user);
  }

  @Get(':id/messages')
  listMessages(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.roomsService.listMessages(id, limit, before);
  }

  @Post(':id/messages')
  createMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.roomsService.createMessage(id, dto, user);
  }
}
