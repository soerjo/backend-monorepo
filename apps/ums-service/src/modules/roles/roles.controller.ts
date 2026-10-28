import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesService } from './roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UMS_ADMIN_ROLE } from '../auth/auth.constants.js';

@ApiTags('Roles')
@ApiBearerAuth()
@Roles(UMS_ADMIN_ROLE)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all roles with user count and permissions' })
  async findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new role' })
  async create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by ID with permissions' })
  async findOne(@Param('id') id: string) {
    return this.rolesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update role details' })
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a role (protected from admin role & assigned users)',
  })
  async remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Put(':id/permissions')
  @ApiOperation({ summary: 'Replace set of permissions assigned to a role' })
  async updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.updatePermissions(id, dto.permissionIds);
  }
}
