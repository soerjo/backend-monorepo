import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccountingService } from './accounting.service.js';
import { CreateJournalEntryDto } from './dto/create-journal.dto.js';
import { CreateCoaDto } from './dto/create-coa.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';

@ApiTags('Accounting & General Ledger')
@ApiBearerAuth()
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Post('coa')
  @Permissions('erp.coa.create')
  @ApiOperation({ summary: 'Create Chart of Accounts (COA) entry' })
  @ApiResponse({ status: 201, description: 'COA created successfully' })
  async createCoa(@Body() dto: CreateCoaDto) {
    return this.accountingService.createCoa(dto);
  }

  @Get('coa')
  @Permissions('erp.coa.view')
  @ApiOperation({ summary: 'List all Chart of Accounts' })
  async listCoa() {
    return this.accountingService.getChartOfAccounts();
  }

  @Post('journals')
  @Permissions('erp.journal.post')
  @ApiOperation({
    summary: 'Create & post journal entry (Double-entry balanced)',
  })
  @ApiResponse({ status: 201, description: 'Journal entry recorded & posted' })
  @ApiResponse({
    status: 422,
    description: 'Double-entry imbalance or invalid debit/credit',
  })
  async createJournal(@Body() dto: CreateJournalEntryDto, @CurrentUser() user: AuthUser) {
    return this.accountingService.createJournalEntry(dto, user.id);
  }

  @Get('journals/:id')
  @Permissions('erp.journal.view')
  @ApiOperation({ summary: 'Get journal entry detail by ID' })
  async getJournal(@Param('id') id: string) {
    return this.accountingService.getJournalEntry(id);
  }
}
