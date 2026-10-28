import { ApiPropertyOptional } from '@nestjs/swagger';
import { StorageBinStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class BinQueryDto {
  @ApiPropertyOptional({ enum: StorageBinStatus, example: 'ACTIVE' })
  @IsEnum(StorageBinStatus)
  @IsOptional()
  status?: StorageBinStatus;

  @ApiPropertyOptional({ example: 'ZONE-A' })
  @IsString()
  @IsOptional()
  zoneName?: string;
}
