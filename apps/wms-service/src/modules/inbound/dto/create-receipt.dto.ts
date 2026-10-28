import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class InboundItemDto {
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
  quantity: number;
}

export class CreateReceiptDto {
  @ApiProperty({ example: 'PO-SHIP-001' })
  @IsString()
  shipmentNo: string;

  @ApiProperty({ example: 'warehouse-uuid' })
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional({ example: 'supplier-uuid' })
  @IsString()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional({ example: 'PO-REF-001' })
  @IsString()
  @IsOptional()
  referencePoNo?: string;

  @ApiProperty({ example: 'receiving-bin-uuid' })
  @IsString()
  receivingBinId: string;

  @ApiProperty({ type: [InboundItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboundItemDto)
  items: InboundItemDto[];
}
