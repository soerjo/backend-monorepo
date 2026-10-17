import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UMS_ADMIN_ROLE } from '../auth/auth.constants.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

@Injectable()
export class RolesRepository {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.role.findMany({
      include: {
        _count: {
          select: { userRoles: true },
        },
        rolePermissions: {
          include: { permission: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count.userRoles,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    }));
  }

  async findById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userRoles: true },
        },
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count.userRoles,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    };
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Role with name '${dto.name}' already exists`);
    }

    let permissionIds = dto.permissionIds ?? [];
    if (permissionIds.length > 0) {
      const perms = await this.prisma.permission.findMany({
        where: { id: { in: permissionIds } },
      });
      if (perms.length !== permissionIds.length) {
        throw new BadRequestException('One or more permission IDs are invalid');
      }
    }

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        rolePermissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: {
        _count: { select: { userRoles: true } },
        rolePermissions: { include: { permission: true } },
      },
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count.userRoles,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    };
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findById(id);

    if (dto.name) {
      const existing = await this.prisma.role.findUnique({
        where: { name: dto.name },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Role with name '${dto.name}' already exists`);
      }
    }

    const role = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: {
        _count: { select: { userRoles: true } },
        rolePermissions: { include: { permission: true } },
      },
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count.userRoles,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    };
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true } } },
    });

    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }

    if (role.name === UMS_ADMIN_ROLE) {
      throw new ForbiddenException(`Role '${UMS_ADMIN_ROLE}' cannot be deleted`);
    }

    if (role._count.userRoles > 0) {
      throw new ConflictException(
        `Role cannot be deleted because it is still assigned to ${role._count.userRoles} user(s)`,
      );
    }

    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted successfully' };
  }

  async updatePermissions(id: string, permissionIds: string[]) {
    await this.findById(id);

    if (permissionIds.length > 0) {
      const perms = await this.prisma.permission.findMany({
        where: { id: { in: permissionIds } },
      });
      if (perms.length !== permissionIds.length) {
        throw new BadRequestException('One or more permission IDs are invalid');
      }
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      }),
    ]);

    return this.findById(id);
  }
}
