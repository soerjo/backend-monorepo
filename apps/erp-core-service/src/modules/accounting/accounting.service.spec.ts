import { Test, TestingModule } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { AccountingService } from './accounting.service.js';
import { AccountingRepository } from './accounting.repository.js';
import { EntrySource, AccountType } from '@prisma/client';
import { CreateJournalEntryDto } from './dto/create-journal.dto.js';

describe('AccountingService', () => {
  let service: AccountingService;
  let mockRepo: {
    createCoa: jest.Mock;
    findAllCoa: jest.Mock;
    findCoaByCode: jest.Mock;
    findCoaByCodeOrThrow: jest.Mock;
    createJournalEntryWithLines: jest.Mock;
    findJournalEntryById: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      createCoa: jest.fn(),
      findAllCoa: jest.fn(),
      findCoaByCode: jest.fn(),
      findCoaByCodeOrThrow: jest.fn(),
      createJournalEntryWithLines: jest.fn(),
      findJournalEntryById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingService,
        {
          provide: AccountingRepository,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AccountingService>(AccountingService);
  });

  it('should reject journal entry if debit does not equal credit (HTTP 422)', async () => {
    const dto: CreateJournalEntryDto = {
      entryDate: '2026-10-29',
      source: EntrySource.BILLING_INVOICE,
      lines: [
        { accountCode: '11100', debit: 1000000, credit: 0 },
        { accountCode: '41100', debit: 0, credit: 950000 }, // imbalance 50,000
      ],
    };

    await expect(service.createJournalEntry(dto, 'user-uuid')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('should reject journal entry if line has both debit and credit', async () => {
    const dto: CreateJournalEntryDto = {
      entryDate: '2026-10-29',
      source: EntrySource.MANUAL,
      lines: [
        { accountCode: '11100', debit: 100000, credit: 50000 },
        { accountCode: '41100', debit: 0, credit: 100000 },
      ],
    };

    await expect(service.createJournalEntry(dto, 'user-uuid')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('should successfully post journal entry when balanced', async () => {
    mockRepo.findCoaByCodeOrThrow.mockImplementation((code: string) =>
      Promise.resolve({
        id: `acc-${code}`,
        code,
        name: `Account ${code}`,
        type: AccountType.ASSET,
        parentId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    mockRepo.createJournalEntryWithLines.mockResolvedValue({
      id: 'je-123',
      entryNumber: 'JE-001',
      entryDate: new Date('2026-10-29'),
      source: EntrySource.BILLING_INVOICE,
      referenceId: 'INV-10928',
      memo: 'Revenue receipt',
      isPosted: true,
      postedAt: new Date(),
      createdBy: 'user-uuid',
      createdAt: new Date(),
    });

    const dto: CreateJournalEntryDto = {
      entryDate: '2026-10-29',
      source: EntrySource.BILLING_INVOICE,
      referenceId: 'INV-10928',
      memo: 'Revenue receipt',
      lines: [
        { accountCode: '11100', debit: 1000000, credit: 0 },
        { accountCode: '41100', debit: 0, credit: 1000000 },
      ],
    };

    const res = await service.createJournalEntry(dto, 'user-uuid');
    expect(res.id).toBe('je-123');
    expect(mockRepo.createJournalEntryWithLines).toHaveBeenCalledTimes(1);
  });
});
