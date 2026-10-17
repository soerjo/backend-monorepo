import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StorageBinsService } from './storage-bins.service.js';
import { CreateStorageBinDto } from './dto/create-storage-bin.dto.js';
import { UpdateBinStatusDto } from './dto/update-bin-status.dto.js';
import { BinQueryDto } from './dto/bin-query.dto.js';

@ApiTags('Storage Bins')
@ApiBearerAuth()
@Controller('v1/warehouses/:warehouseId/bins')
export class WarehouseBinsController {
  constructor(private readonly storageBinsService: StorageBinsService) {}

  @Get()
  async findAllByWarehouse(
    @Param('warehouseId') warehouseId: string,
    @Query() query: BinQueryDto,
  ) {
    return this.storageBinsService.findAllByWarehouse(warehouseId, query);
  }

  @Post()
  async create(
    @Param('warehouseId') warehouseId: string,
    @Body() dto: CreateStorageBinDto,
  ) {
    return this.storageBinsService.create(warehouseId, dto);
  }
}

@ApiTags('Storage Bins')
@ApiBearerAuth()
@Controller('v1/bins')
export class StorageBinsController {
  constructor(private readonly storageBinsService: StorageBinsService) {}

  @Patch(':id')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateBinStatusDto) {
    return this.storageBinsService.updateStatus(id, dto.status);
  }
}
