import { Injectable } from '@nestjs/common';
import type { FileUpload, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class FilesRepository {
  constructor(private prisma: PrismaService) {}

  async create(
    data: Prisma.XOR<
      Prisma.FileUploadCreateInput,
      Prisma.FileUploadUncheckedCreateInput
    >,
  ): Promise<FileUpload> {
    return this.prisma.fileUpload.create({ data });
  }

  async findById(id: string): Promise<FileUpload | null> {
    return this.prisma.fileUpload.findUnique({ where: { id } });
  }

  async findMany(params: {
    where: Prisma.FileUploadWhereInput;
    orderBy: Prisma.FileUploadOrderByWithRelationInput;
    skip: number;
    take: number;
  }): Promise<FileUpload[]> {
    return this.prisma.fileUpload.findMany({
      where: params.where,
      orderBy: params.orderBy,
      skip: params.skip,
      take: params.take,
    });
  }

  async count(where: Prisma.FileUploadWhereInput): Promise<number> {
    return this.prisma.fileUpload.count({ where });
  }

  async softDelete(id: string, userId: string): Promise<number> {
    const result = await this.prisma.fileUpload.updateMany({
      where: { id, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: userId },
    });
    return result.count;
  }

  async findPurgeable(cutoff: Date, take: number): Promise<FileUpload[]> {
    return this.prisma.fileUpload.findMany({
      where: { isDeleted: true, deletedAt: { lt: cutoff } },
      orderBy: { deletedAt: 'asc' },
      take,
    });
  }

  async hardDelete(id: string): Promise<void> {
    await this.prisma.fileUpload.delete({ where: { id } });
  }
}
