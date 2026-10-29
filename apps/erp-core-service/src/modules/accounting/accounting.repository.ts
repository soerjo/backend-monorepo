import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ChartOfAccount, JournalEntry, Prisma } from '@prisma/client';
import { CreateCoaDto } from './dto/create-coa.dto.js';

@Injectable()
export class AccountingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createCoa(dto: CreateCoaDto): Promise<ChartOfAccount> {
    return this.prisma.chartOfAccount.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
        parentId: dto.parentId,
      },
    });
  }

  async findCoaByCode(code: string): Promise<ChartOfAccount | null> {
    return this.prisma.chartOfAccount.findUnique({
      where: { code },
    });
  }

  async findCoaByCodeOrThrow(code: string): Promise<ChartOfAccount> {
    const coa = await this.findCoaByCode(code);
    if (!coa) {
      throw new NotFoundException(`Account with code '${code}' not found`);
    }
    return coa;
  }

  async findAllCoa(): Promise<ChartOfAccount[]> {
    return this.prisma.chartOfAccount.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async createJournalEntryWithLines(data: Prisma.JournalEntryCreateInput): Promise<JournalEntry> {
    return this.prisma.journalEntry.create({
      data,
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });
  }

  async findJournalEntryById(id: string) {
    return this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });
  }
}
