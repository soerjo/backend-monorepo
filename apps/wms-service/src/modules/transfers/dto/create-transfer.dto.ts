import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class TransferItemDto {
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

  @ApiProperty({ example: 25 })
  @IsNumber()
  @Type(() => Number)
  quantity: number;
}

export class CreateTransferDto {
  @ApiProperty({ example: 'TR-001' })
  @IsString()
  transferNo: string;

  @ApiProperty({ example: 'warehouse-origin-uuid' })
  @IsString()
  originWarehouseId: string;

  @ApiProperty({ example: 'warehouse-dest-uuid' })
  @IsString()
  destinationWarehouseId: string;

  @ApiProperty({ type: [TransferItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];
}
