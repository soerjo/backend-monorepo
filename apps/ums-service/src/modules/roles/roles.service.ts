import { Injectable } from '@nestjs/common';
import { RolesRepository } from './roles.repository.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class RolesService {
  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.rolesRepository.findAll();
  }

  async findById(id: string) {
    return this.rolesRepository.findById(id);
  }

  async create(dto: CreateRoleDto) {
    const role = await this.rolesRepository.create(dto);
    await this.auditService.log({
      action: 'role.created',
      actorType: 'admin',
      subjectType: 'role',
      subjectId: role.id,
      metadata: { name: role.name },
    });
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.rolesRepository.update(id, dto);
    await this.auditService.log({
      action: 'role.updated',
      actorType: 'admin',
      subjectType: 'role',
      subjectId: role.id,
      metadata: { name: role.name },
    });
    return role;
  }

  async remove(id: string) {
    const role = await this.rolesRepository.remove(id);
    await this.auditService.log({
      action: 'role.deleted',
      actorType: 'admin',
      severity: 'warn',
      subjectType: 'role',
      subjectId: id,
    });
    return role;
  }

  async updatePermissions(id: string, permissionIds: string[]) {
    const role = await this.rolesRepository.updatePermissions(
      id,
      permissionIds,
    );
    await this.auditService.log({
      action: 'role.permissions.updated',
      actorType: 'admin',
      severity: 'warn',
      subjectType: 'role',
      subjectId: id,
      metadata: { permissionIds },
    });
    return role;
  }
}
