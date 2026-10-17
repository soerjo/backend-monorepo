import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class OnHandQueryDto {
  @ApiPropertyOptional({ example: 'warehouse-uuid' })
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional({ example: 'SKU-001' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ example: 'BATCH-001' })
  @IsString()
  @IsOptional()
  batchNumber?: string;
}
