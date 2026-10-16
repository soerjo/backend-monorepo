import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateTagDto } from './dto/create-tag.dto.js';
import { UpdateTagDto } from './dto/update-tag.dto.js';

@Injectable()
export class TagsRepository {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTagDto) {
    return this.prisma.tag.create({
      data: {
        key: dto.key,
        name: dto.name,
      },
    });
  }

  async findAll() {
    return this.prisma.tag.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const item = await this.prisma.tag.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }
    return item;
  }

  async update(id: string, dto: UpdateTagDto) {
    await this.findById(id);
    return this.prisma.tag.update({
      where: { id },
      data: {
        ...(dto.key && { key: dto.key }),
        ...(dto.name && { name: dto.name }),
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.tag.delete({
      where: { id },
    });
  }
}
