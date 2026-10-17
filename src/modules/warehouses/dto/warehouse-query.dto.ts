import { ApiPropertyOptional } from '@nestjs/swagger';
import { WarehouseType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class WarehouseQueryDto {
  @ApiPropertyOptional({ enum: WarehouseType, example: 'CENTRAL_DC' })
  @IsEnum(WarehouseType)
  @IsOptional()
  type?: WarehouseType;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
