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
import { successResponse } from '../../common/helpers/response.helper';

@Controller('rooms')
@UseGuards(SessionAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async findAll() {
    const data = await this.roomsService.findAll();
    return successResponse(data);
  }

  @Post()
  async create(
    @Body() createRoomDto: CreateRoomDto,
    @CurrentUser() user: SessionUser,
  ) {
    const data = await this.roomsService.create(createRoomDto, user);
    return successResponse(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.roomsService.findOne(id);
    return successResponse(data);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    const data = await this.roomsService.remove(id, user);
    return successResponse(data);
  }

  @Get(':id/messages')
  async listMessages(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const data = await this.roomsService.listMessages(id, limit, before);
    return successResponse(data);
  }

  @Post(':id/messages')
  async createMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: SessionUser,
  ) {
    const data = await this.roomsService.createMessage(id, dto, user);
    return successResponse(data);
  }
}
