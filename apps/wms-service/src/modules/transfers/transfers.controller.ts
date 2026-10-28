import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransfersService } from './transfers.service.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { BinTransferDto } from './dto/bin-transfer.dto.js';

@ApiTags('Stock Transfers')
@ApiBearerAuth()
@Controller('v1/transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  async create(@Body() dto: CreateTransferDto) {
    return this.transfersService.create(dto);
  }

  @Post(':id/dispatch')
  async dispatch(@Param('id') id: string) {
    return this.transfersService.dispatch(id);
  }

  @Post(':id/receive')
  async receive(
    @Param('id') id: string,
    @Body('destinationBinId') destinationBinId: string,
  ) {
    return this.transfersService.receive(id, destinationBinId);
  }

  @Post('bin-transfer')
  async binTransfer(@Body() dto: BinTransferDto) {
    return this.transfersService.binTransfer(dto);
  }
}
