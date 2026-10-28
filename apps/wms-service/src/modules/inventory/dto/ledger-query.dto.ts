import { ApiPropertyOptional } from '@nestjs/swagger';
import { StockLedgerRefType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';

export class LedgerQueryDto {
  @ApiPropertyOptional({ example: 'warehouse-uuid' })
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional({ example: 'SKU-001' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ enum: StockLedgerRefType, example: 'INBOUND_PO' })
  @IsEnum(StockLedgerRefType)
  @IsOptional()
  referenceType?: StockLedgerRefType;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
