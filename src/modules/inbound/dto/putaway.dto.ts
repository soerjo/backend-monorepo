import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class PutawayDto {
  @ApiProperty({ example: 'shipment-uuid' })
  @IsString()
  shipmentId: string;

  @ApiProperty({ example: 'item-uuid' })
  @IsString()
  itemId: string;

  @ApiProperty({ example: 'source-bin-uuid' })
  @IsString()
  sourceBinId: string;

  @ApiProperty({ example: 'target-bin-uuid' })
  @IsString()
  targetBinId: string;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Type(() => Number)
  quantity: number;
}
