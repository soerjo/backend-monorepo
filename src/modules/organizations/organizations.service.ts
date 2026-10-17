import { Injectable } from '@nestjs/common';
import { OrganizationsRepository } from './organizations.repository.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { AddMemberDto } from './dto/add-member.dto.js';

@Injectable()
export class OrganizationsService {
  constructor(private organizationsRepository: OrganizationsRepository) {}

  async findAll() {
    return this.organizationsRepository.findAll();
  }

  async findById(id: string) {
    return this.organizationsRepository.findById(id);
  }

  async create(dto: CreateOrganizationDto) {
    return this.organizationsRepository.create(dto);
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    return this.organizationsRepository.update(id, dto);
  }

  async remove(id: string) {
    return this.organizationsRepository.remove(id);
  }

  async listMembers(id: string) {
    return this.organizationsRepository.listMembers(id);
  }

  async addMember(id: string, dto: AddMemberDto) {
    return this.organizationsRepository.addMember(
      id,
      dto.userId,
      dto.role ?? 'member',
    );
  }

  async removeMember(id: string, userId: string) {
    return this.organizationsRepository.removeMember(id, userId);
  }
}
