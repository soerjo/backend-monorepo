import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StorageBinStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStorageBinDto {
  @ApiProperty({ example: 'A01-B02-C03' })
  @IsString()
  @IsNotEmpty()
  binCode: string;

  @ApiProperty({ example: 'ZONE-A' })
  @IsString()
  @IsNotEmpty()
  zoneName: string;

  @ApiPropertyOptional({ example: 'A01' })
  @IsString()
  @IsOptional()
  aisle?: string;

  @ApiPropertyOptional({ example: 'B02' })
  @IsString()
  @IsOptional()
  rack?: string;

  @ApiPropertyOptional({ enum: StorageBinStatus, default: 'ACTIVE' })
  @IsEnum(StorageBinStatus)
  @IsOptional()
  status?: StorageBinStatus;
}
