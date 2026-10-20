import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  WebhooksService,
  type MidtransWebhookPayload,
} from './webhooks.service.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Webhooks')
@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Public()
  @Post('midtrans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Public webhook receiver for Midtrans payment notifications with SHA512 signature check',
  })
  async handleMidtransWebhook(@Body() payload: MidtransWebhookPayload) {
    return this.webhooksService.handleMidtransWebhook(payload);
  }
}
