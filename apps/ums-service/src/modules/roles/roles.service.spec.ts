import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service.js';
import { RolesRepository } from './roles.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { UMS_ADMIN_ROLE } from '../auth/auth.constants.js';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: {
    role: {
      findUnique: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    permission: { findMany: jest.Mock };
    rolePermission: { deleteMany: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      role: {
        findUnique: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      permission: { findMany: jest.fn() },
      rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        RolesRepository,
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  describe('remove', () => {
    it('forbids deleting the ums:admin role', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-1',
        name: UMS_ADMIN_ROLE,
        _count: { userRoles: 0 },
      });

      await expect(service.remove('role-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('conflicts if role is still assigned to users', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-2',
        name: 'custom-role',
        _count: { userRoles: 3 },
      });

      await expect(service.remove('role-2')).rejects.toThrow(ConflictException);
    });

    it('deletes successfully if safe', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-3',
        name: 'custom-role',
        _count: { userRoles: 0 },
      });
      prisma.role.delete.mockResolvedValue({});

      await expect(service.remove('role-3')).resolves.toEqual({
        message: 'Role deleted successfully',
      });
    });
  });
});
