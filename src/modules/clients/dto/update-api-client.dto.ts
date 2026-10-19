import { PartialType } from '@nestjs/swagger';
import { CreateApiClientDto } from './create-api-client.dto.js';

export class UpdateApiClientDto extends PartialType(CreateApiClientDto) {}
