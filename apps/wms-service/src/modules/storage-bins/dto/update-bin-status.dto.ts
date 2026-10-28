import { ApiProperty } from '@nestjs/swagger';
import { StorageBinStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateBinStatusDto {
  @ApiProperty({ enum: StorageBinStatus, example: 'ACTIVE' })
  @IsEnum(StorageBinStatus)
  status: StorageBinStatus;
}
