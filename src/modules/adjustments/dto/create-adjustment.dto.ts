import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockAdjustmentReason } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AdjustmentItemDto {
  @ApiProperty({ example: 'bin-uuid' })
  @IsString()
  binId: string;

  @ApiProperty({ example: 'prod-uuid' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 'SKU-001' })
  @IsString()
  sku: string;

  @ApiPropertyOptional({ example: 'BATCH-001', default: '-' })
  @IsString()
  @IsOptional()
  batchNumber?: string;

  @ApiPropertyOptional({ example: '2026-12-31T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Type(() => Number)
  currentQuantity: number;

  @ApiProperty({ example: 95 })
  @IsNumber()
  @Type(() => Number)
  adjustedQuantity: number;
}

export class CreateAdjustmentDto {
  @ApiProperty({ example: 'ADJ-001' })
  @IsString()
  adjustmentNo: string;

  @ApiProperty({ example: 'warehouse-uuid' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ enum: StockAdjustmentReason, example: 'SHRINKAGE' })
  @IsEnum(StockAdjustmentReason)
  reason: StockAdjustmentReason;

  @ApiPropertyOptional({ example: 50.0 })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  requestedValue?: number;

  @ApiPropertyOptional({ example: 'Monthly cycle count adjustment' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [AdjustmentItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdjustmentItemDto)
  items: AdjustmentItemDto[];
}
