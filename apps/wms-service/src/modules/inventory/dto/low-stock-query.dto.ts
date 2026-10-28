import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class LowStockQueryDto {
  @ApiPropertyOptional({ example: 'warehouse-uuid' })
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  threshold?: number;
}
