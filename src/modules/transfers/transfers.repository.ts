import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class TransfersRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: true,
        originWarehouse: true,
        destinationWarehouse: true,
      },
    });
    if (!transfer) {
      throw new NotFoundException(`Stock transfer with id ${id} not found`);
    }
    return transfer;
  }
}
