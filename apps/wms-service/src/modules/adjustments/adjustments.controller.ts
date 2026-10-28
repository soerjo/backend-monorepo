import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdjustmentsService } from './adjustments.service.js';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto.js';
import { ApproveAdjustmentDto } from './dto/approve-adjustment.dto.js';

@ApiTags('Stock Adjustments')
@ApiBearerAuth()
@Controller('v1/inventory/adjustments')
export class AdjustmentsController {
  constructor(private readonly adjustmentsService: AdjustmentsService) {}

  @Post()
  async create(@Body() dto: CreateAdjustmentDto) {
    return this.adjustmentsService.create(dto);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() dto: ApproveAdjustmentDto) {
    return this.adjustmentsService.approve(id, dto);
  }
}
