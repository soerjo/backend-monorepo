import { Injectable } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository.js';
import { CreatePermissionDto } from './dto/create-permission.dto.js';
import { UpdatePermissionDto } from './dto/update-permission.dto.js';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async findAll() {
    return this.permissionsRepository.findAll();
  }

  async findById(id: string) {
    return this.permissionsRepository.findById(id);
  }

  async create(dto: CreatePermissionDto) {
    return this.permissionsRepository.create(dto);
  }

  async update(id: string, dto: UpdatePermissionDto) {
    return this.permissionsRepository.update(id, dto);
  }

  async remove(id: string) {
    return this.permissionsRepository.remove(id);
  }
}
