import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InboundService } from './inbound.service.js';
import { CreateReceiptDto } from './dto/create-receipt.dto.js';
import { PutawayDto } from './dto/putaway.dto.js';

@ApiTags('Inbound Management')
@ApiBearerAuth()
@Controller('v1/inbound')
export class InboundController {
  constructor(private readonly inboundService: InboundService) {}

  @Post('receipts')
  async createReceipt(@Body() dto: CreateReceiptDto) {
    return this.inboundService.createReceipt(dto);
  }

  @Post('putaway')
  async putaway(@Body() dto: PutawayDto) {
    return this.inboundService.putaway(dto);
  }
}
