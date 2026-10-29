import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePoItemDto {
  @ApiProperty({ description: 'Product UUID' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Quantity ordered', example: 100 })
  @IsNumber()
  @Min(0.0001)
  qtyOrdered: number;

  @ApiProperty({ description: 'Unit purchase price', example: 50000 })
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreatePoDto {
  @ApiProperty({ description: 'Vendor UUID' })
  @IsUUID()
  @IsNotEmpty()
  vendorId: string;

  @ApiPropertyOptional({
    description: 'Expected delivery date (YYYY-MM-DD)',
    example: '2026-11-15',
  })
  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({
    description: 'Internal / procurement notes',
    example: 'Pengadaan stok kuartal 4',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [CreatePoItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePoItemDto)
  items: CreatePoItemDto[];
}
