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
import { WarehousesService } from './warehouses.service.js';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';
import { WarehouseQueryDto } from './dto/warehouse-query.dto.js';

@ApiTags('Warehouses')
@ApiBearerAuth()
@Controller('v1/warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  async findAll(@Query() query: WarehouseQueryDto) {
    return this.warehousesService.findAll(query);
  }

  @Post()
  async create(@Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.warehousesService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, dto);
  }
}
