import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsArray,
} from 'class-validator';

export class CreateContentTypeDto {
  @ApiProperty({ example: 'article' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ example: 'Article' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Blog article content type' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: [{ key: 'title', type: 'text', label: 'Title', required: true }],
  })
  @IsArray()
  fields!: any[];

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isSingleton?: boolean;
}
