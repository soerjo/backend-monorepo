import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionsService, SessionDto } from './sessions.service.js';
import { REFRESH_COOKIE_NAME } from '../auth/auth.constants.js';

@ApiTags('Sessions')
@ApiBearerAuth()
@Controller('auth/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOkResponse({
    description:
      'Active sessions of the caller, newest first; exactly one current:true (with the refresh cookie present)',
  })
  @ApiOperation({
    summary:
      'List the caller\u2019s active sessions (revoked/expired excluded, newest first)',
  })
  async listOwn(@Req() req: Request): Promise<SessionDto[]> {
    return this.sessionsService.listOwn(
      (req as Request & { user: { id: string } }).user.id,
      req.headers.cookie,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Revoke one owned session and its whole family (404 shared message for not-exists/not-owned)',
  })
  @ApiNoContentResponse({ description: 'unused' })
  async revokeOwn(@Param('id') id: string, @Req() req: Request): Promise<null> {
    await this.sessionsService.revokeOwn(
      id,
      (req as Request & { user: { id: string } }).user.id,
    );
    return null;
  }
}
