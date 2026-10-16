import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateContentTypeDto } from './dto/create-content-type.dto.js';
import { UpdateContentTypeDto } from './dto/update-content-type.dto.js';

@Injectable()
export class ContentTypesRepository {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateContentTypeDto) {
    return this.prisma.contentType.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        fields: dto.fields,
        isSingleton: dto.isSingleton ?? false,
      },
    });
  }

  async findAll() {
    return this.prisma.contentType.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const item = await this.prisma.contentType.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!item) {
      throw new NotFoundException(`ContentType with ID ${id} not found`);
    }
    return item;
  }

  async findByKey(key: string) {
    const item = await this.prisma.contentType.findUnique({
      where: { key },
    });
    if (!item) {
      throw new NotFoundException(`ContentType with key ${key} not found`);
    }
    return item;
  }

  async update(id: string, dto: UpdateContentTypeDto) {
    await this.findById(id);
    return this.prisma.contentType.update({
      where: { id },
      data: {
        ...(dto.key && { key: dto.key }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.fields && { fields: dto.fields }),
        ...(dto.isSingleton !== undefined && { isSingleton: dto.isSingleton }),
      },
    });
  }

  async delete(id: string) {
    const item = await this.findById(id);
    if (item._count.entries > 0) {
      throw new ConflictException(
        'Cannot delete ContentType that has associated entries',
      );
    }
    return this.prisma.contentType.delete({
      where: { id },
    });
  }
}
