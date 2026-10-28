import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

const MEMBER_SELECT = {
  role: true,
  joinedAt: true,
  user: {
    select: { id: true, email: true, name: true, status: true },
  },
} as const;

@Injectable()
export class OrganizationsRepository {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.organization.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });
    if (!organization) {
      throw new NotFoundException(`Organization with id ${id} not found`);
    }
    return organization;
  }

  async create(data: { name: string; description?: string }) {
    return this.prisma.organization.create({ data });
  }

  async update(id: string, data: { name?: string; description?: string }) {
    await this.findById(id);
    return this.prisma.organization.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.organization.delete({ where: { id } });
  }

  async listMembers(orgId: string) {
    await this.findById(orgId);
    return this.prisma.orgMember.findMany({
      where: { orgId },
      select: MEMBER_SELECT,
      orderBy: { joinedAt: 'asc' },
    });
  }

  async addMember(orgId: string, userId: string, role: string) {
    await this.findById(orgId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    return this.prisma.orgMember.upsert({
      where: { orgId_userId: { orgId, userId } },
      create: { orgId, userId, role },
      update: { role },
      select: MEMBER_SELECT,
    });
  }

  async removeMember(orgId: string, userId: string) {
    await this.findById(orgId);
    const member = await this.prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    if (!member) {
      throw new NotFoundException(
        `User ${userId} is not a member of organization ${orgId}`,
      );
    }

    await this.prisma.orgMember.delete({
      where: { orgId_userId: { orgId, userId } },
    });

    return { success: true };
  }
}
