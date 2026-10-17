import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard.js';
import { SendNotificationDto } from './dto/send-notification.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('v1/notifications')
@Public()
@UseGuards(InternalAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @HttpCode(202)
  async send(
    @Body() dto: SendNotificationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.notificationsService.send(dto);
    response.status(result.idempotent ? 200 : 202);
    return {
      notification_ids: result.notificationIds,
      trace_id: result.traceId,
    };
  }

  @Get(':id/logs')
  async logs(@Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.getLogs(id);
  }
}
