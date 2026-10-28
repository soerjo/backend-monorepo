import {
  Body,
  Controller,
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
import { ClientsService } from './clients.service.js';
import { CreateApiClientDto } from './dto/create-api-client.dto.js';
import { UpdateApiClientDto } from './dto/update-api-client.dto.js';

@ApiTags('Clients')
@ApiBearerAuth()
@Roles(UMS_ADMIN_ROLE)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'List API clients (M2M credentials)' })
  findAll() {
    return this.clientsService.findAll();
  }

  @Post()
  @ApiOperation({
    summary: 'Create an API client; the raw clientSecret is returned once',
  })
  create(@Body() dto: CreateApiClientDto) {
    return this.clientsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an API client by id' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an API client name, scopes or rate limit' })
  update(@Param('id') id: string, @Body() dto: UpdateApiClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an API client (active = false)' })
  revoke(@Param('id') id: string) {
    return this.clientsService.revoke(id);
  }
}
