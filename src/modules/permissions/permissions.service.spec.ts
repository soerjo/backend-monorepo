import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from './permissions.service.js';
import { PermissionsRepository } from './permissions.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConflictException } from '@nestjs/common';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: {
    permission: {
      findUnique: jest.Mock;
      delete: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      permission: {
        findUnique: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        PermissionsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  describe('remove', () => {
    it('conflicts if permission is assigned to any role', async () => {
      prisma.permission.findUnique.mockResolvedValue({
        id: 'p-1',
        name: 'users:read',
        _count: { rolePermissions: 2 },
      });

      await expect(service.remove('p-1')).rejects.toThrow(ConflictException);
    });

    it('deletes successfully if not assigned', async () => {
      prisma.permission.findUnique.mockResolvedValue({
        id: 'p-2',
        name: 'users:read',
        _count: { rolePermissions: 0 },
      });
      prisma.permission.delete.mockResolvedValue({});

      await expect(service.remove('p-2')).resolves.toEqual({
        message: 'Permission deleted successfully',
      });
    });
  });
});
