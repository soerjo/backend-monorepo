import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UMS_ADMIN_ROLE } from '../auth/auth.constants.js';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto.js';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto.js';
import { WebhooksService } from './webhooks.service.js';

@ApiTags('Webhooks')
@ApiBearerAuth()
@Roles(UMS_ADMIN_ROLE)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'List webhook endpoints' })
  findAll() {
    return this.webhooksService.findAll();
  }

  @Post()
  @ApiOperation({
    summary: 'Register a webhook endpoint; the raw secret is returned once',
  })
  create(@Body() dto: CreateWebhookEndpointDto) {
    return this.webhooksService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook endpoint by id' })
  findOne(@Param('id') id: string) {
    return this.webhooksService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a webhook endpoint url, events or active' })
  update(@Param('id') id: string, @Body() dto: UpdateWebhookEndpointDto) {
    return this.webhooksService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook endpoint and its deliveries' })
  remove(@Param('id') id: string) {
    return this.webhooksService.remove(id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a webhook.test event through the dispatcher' })
  sendTest(@Param('id') id: string) {
    return this.webhooksService.sendTest(id);
  }
}
