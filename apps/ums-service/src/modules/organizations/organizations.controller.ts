import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UMS_ADMIN_ROLE } from '../auth/auth.constants.js';

@ApiTags('Organizations')
@ApiBearerAuth()
@Roles(UMS_ADMIN_ROLE)
@Controller('orgs')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List organizations' })
  async findAll() {
    return this.organizationsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create an organization' })
  async create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an organization by id' })
  async findOne(@Param('id') id: string) {
    return this.organizationsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an organization' })
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an organization' })
  async remove(@Param('id') id: string) {
    return this.organizationsService.remove(id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List organization members' })
  async listMembers(@Param('id') id: string) {
    return this.organizationsService.listMembers(id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add or update an organization member' })
  async addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.organizationsService.addMember(id, dto);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove an organization member' })
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.organizationsService.removeMember(id, userId);
  }
}
