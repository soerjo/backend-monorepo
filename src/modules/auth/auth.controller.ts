import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { LocalAuthGuard } from './local-auth.guard.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() _loginDto: LoginDto, @Req() req: { user: AuthUser }) {
    return this.authService.login(req.user);
  }

  @Get('verify-token')
  @HttpCode(HttpStatus.OK)
  verifyToken(@CurrentUser() user: AuthUser) {
    return { valid: true, user: { ...user } };
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password changed successfully')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
