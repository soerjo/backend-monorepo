import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SalesReportQueryDto {
  @ApiPropertyOptional({ description: 'Filter by organization ID' })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Start date YYYY-MM-DD' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date YYYY-MM-DD' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
