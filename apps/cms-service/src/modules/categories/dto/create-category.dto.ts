import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'tech' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ example: 'Technology' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'parent-category-uuid' })
  @IsString()
  @IsOptional()
  parentId?: string;
}
