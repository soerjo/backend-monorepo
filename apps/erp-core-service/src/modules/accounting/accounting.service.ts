import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AccountingRepository } from './accounting.repository.js';
import { CreateJournalEntryDto } from './dto/create-journal.dto.js';
import { CreateCoaDto } from './dto/create-coa.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class AccountingService {
  constructor(private readonly repository: AccountingRepository) {}

  async createCoa(dto: CreateCoaDto) {
    return this.repository.createCoa(dto);
  }

  async getChartOfAccounts() {
    return this.repository.findAllCoa();
  }

  /**
   * Automated Double-entry bookkeeping rule:
   * sum(Debit) === sum(Credit).
   * If sum(Debit) !== sum(Credit), reject with HTTP 422 Unprocessable Entity.
   */
  async createJournalEntry(dto: CreateJournalEntryDto, createdBy: string) {
    if (!dto.lines || dto.lines.length < 2) {
      throw new UnprocessableEntityException(
        'A journal entry must contain at least 2 lines (double-entry requirement)',
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of dto.lines) {
      if (line.debit > 0 && line.credit > 0) {
        throw new UnprocessableEntityException(
          `Line for account '${line.accountCode}' cannot have both debit and credit greater than zero`,
        );
      }
      if (line.debit === 0 && line.credit === 0) {
        throw new UnprocessableEntityException(
          `Line for account '${line.accountCode}' must have either debit or credit greater than zero`,
        );
      }
      totalDebit += Number(line.debit);
      totalCredit += Number(line.credit);
    }

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.0001) {
      throw new UnprocessableEntityException(
        `Double-entry imbalance: total debit (${totalDebit}) does not equal total credit (${totalCredit})`,
      );
    }

    // Resolve COA accounts
    const lineCreations: Prisma.JournalLineCreateWithoutJournalEntryInput[] = [];
    for (const line of dto.lines) {
      const coa = await this.repository.findCoaByCodeOrThrow(line.accountCode);
      lineCreations.push({
        account: { connect: { id: coa.id } },
        debit: new Prisma.Decimal(line.debit),
        credit: new Prisma.Decimal(line.credit),
        lineDescription: line.lineDescription ?? null,
      });
    }

    const entryNumber = `JE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return this.repository.createJournalEntryWithLines({
      entryNumber,
      entryDate: new Date(dto.entryDate),
      source: dto.source,
      referenceId: dto.referenceId,
      memo: dto.memo,
      isPosted: true,
      postedAt: new Date(),
      createdBy,
      lines: {
        create: lineCreations,
      },
    });
  }

  async getJournalEntry(id: string) {
    return this.repository.findJournalEntryById(id);
  }
}
