import { PartialType } from '@nestjs/swagger';
import { CreateWebhookEndpointDto } from './create-webhook-endpoint.dto.js';

export class UpdateWebhookEndpointDto extends PartialType(
  CreateWebhookEndpointDto,
) {}
