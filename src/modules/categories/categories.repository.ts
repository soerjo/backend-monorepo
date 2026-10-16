import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesRepository {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        key: dto.key,
        name: dto.name,
        parentId: dto.parentId,
      },
    });
  }

  async findAll() {
    return this.prisma.category.findMany({
      include: { children: true, parent: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const item = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true, parent: true },
    });
    if (!item) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return item;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findById(id);
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.key && { key: dto.key }),
        ...(dto.name && { name: dto.name }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.category.delete({
      where: { id },
    });
  }
}
