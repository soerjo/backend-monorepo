import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListAuditLogsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'Exact action name filter, e.g. auth.login.failed',
  })
  @IsString()
  @MaxLength(128)
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({
    enum: ['info', 'warn', 'critical'],
    description: 'Severity filter',
  })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  severity?: string;

  @ApiPropertyOptional({ description: 'Actor id (user id) filter' })
  @IsString()
  @MaxLength(64)
  @IsOptional()
  actorId?: string;
}
