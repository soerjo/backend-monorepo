import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AdjustmentsRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const adjustment = await this.prisma.stockAdjustment.findUnique({
      where: { id },
      include: { items: true, warehouse: true },
    });
    if (!adjustment) {
      throw new NotFoundException(`Stock adjustment with id ${id} not found`);
    }
    return adjustment;
  }
}
