import { IsArray, IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class WmsReceivedItemDto {
  @ApiProperty({ example: 'SKU-BEV-001' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0.0001)
  qtyReceived: number;
}

export class WmsGoodsReceivedDto {
  @ApiProperty({ example: 'PO-202610-0001' })
  @IsString()
  @IsNotEmpty()
  poNumber: string;

  @ApiProperty({ example: 'GRN-2026-0091' })
  @IsString()
  @IsNotEmpty()
  wmsReceiptId: string;

  @ApiProperty({ type: [WmsReceivedItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WmsReceivedItemDto)
  receivedItems: WmsReceivedItemDto[];
}
