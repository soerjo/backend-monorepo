import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SalesService } from './sales.service.js';
import { PosSyncDto } from './dto/pos-sync.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Sales & POS Aggregation (O2C)')
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('pos-sync')
  @Public() // Can be secured via internal webhook signature or UMS machine token
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ingest POS transaction webhook' })
  @ApiResponse({
    status: 202,
    description: 'POS transaction queued for ledger & inventory sync',
  })
  async syncPosTransaction(@Body() dto: PosSyncDto) {
    return this.salesService.ingestPosTransaction(dto);
  }
}
