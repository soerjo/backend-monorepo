import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class BinTransferDto {
  @ApiProperty({ example: 'warehouse-uuid' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ example: 'source-bin-uuid' })
  @IsString()
  sourceBinId: string;

  @ApiProperty({ example: 'target-bin-uuid' })
  @IsString()
  targetBinId: string;

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

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Type(() => Number)
  quantity: number;
}
