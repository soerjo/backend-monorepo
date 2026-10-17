import { PartialType } from '@nestjs/swagger';
import { CreateWarehouseDto } from './create-warehouse.dto.js';

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {}
