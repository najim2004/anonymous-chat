import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { successResponse } from '../../common/helpers/response.helper';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() createAuthDto: CreateAuthDto) {
    const data = await this.authService.login(createAuthDto);
    return successResponse(data);
  }
}
