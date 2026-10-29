import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PosSyncItemDto {
  @ApiProperty({ example: 'SKU-BEV-001' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 3 })
  @IsNumber()
  @Min(0.0001)
  qty: number;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class PosSyncDto {
  @ApiProperty({ example: 'POS-JKT01-99882' })
  @IsString()
  @IsNotEmpty()
  posTransactionId: string;

  @ApiProperty({ example: 'STORE-KUNINGAN' })
  @IsString()
  @IsNotEmpty()
  storeCode: string;

  @ApiProperty({ example: '2026-10-29T10:30:00Z' })
  @IsDateString()
  @IsNotEmpty()
  timestamp: string;

  @ApiProperty({ example: 150000 })
  @IsNumber()
  @Min(0)
  totalPaid: number;

  @ApiProperty({ example: 'CASH' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({ type: [PosSyncItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosSyncItemDto)
  items: PosSyncItemDto[];
}
