import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FormSubmissionStatus } from '@prisma/client';

export class QuerySubmissionsDto {
  @ApiPropertyOptional({
    description: 'Filter submissions by form key (e.g. contact-form)',
    example: 'contact-form',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  formKey?: string;

  @ApiPropertyOptional({
    enum: FormSubmissionStatus,
    description: 'Filter submissions by processing status',
  })
  @IsOptional()
  @IsEnum(FormSubmissionStatus)
  status?: FormSubmissionStatus;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Submissions per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
