import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListFilesQueryDto {
  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Page number (>= 1)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Items per page (>= 1, clamped to max 100)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit: number = 20;

  @ApiPropertyOptional({
    example: 'invoice',
    description: 'Case-insensitive contains on originalName',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'createdAt:desc',
    default: 'createdAt:desc',
    description: 'Sort — <createdAt|originalName|size>:<asc|desc>',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
