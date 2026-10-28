import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { SessionsService } from '../sessions/sessions.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { AssignRolesDto } from './dto/assign-roles.dto.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UMS_ADMIN_ROLE } from '../auth/auth.constants.js';

@ApiTags('Users')
@ApiBearerAuth()
@Roles(UMS_ADMIN_ROLE)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List users (paginated)' })
  async findAll(@Query() query: ListUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user name and/or status' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post(':id/roles')
  @ApiOperation({ summary: 'Replace the set of roles assigned to a user' })
  async assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto) {
    return this.usersService.assignRoles(id, dto);
  }

  @Get(':id/sessions')
  @ApiOperation({
    summary: 'List the user\u2019s active sessions (admin; no current flag)',
  })
  async listSessions(@Param('id') id: string) {
    return this.sessionsService.listForUser(id);
  }

  @Delete(':id/sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Revoke ALL of the user\u2019s sessions (admin); returns revoked count',
  })
  async revokeAllSessions(@Param('id') id: string) {
    return this.sessionsService.revokeAllForUser(id);
  }
}
