import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsArray,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export type FieldType =
  | 'text'
  | 'rich_text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'media'
  | 'reference'
  | 'select'
  | 'multi_select';

export class FieldDefinitionDto {
  @ApiProperty({ example: 'title' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ example: 'Title' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({
    example: 'text',
    enum: [
      'text',
      'rich_text',
      'number',
      'boolean',
      'date',
      'media',
      'reference',
      'select',
      'multi_select',
    ],
  })
  @IsString()
  @IsIn([
    'text',
    'rich_text',
    'number',
    'boolean',
    'date',
    'media',
    'reference',
    'select',
    'multi_select',
  ])
  type!: FieldType;

  @ApiProperty({ example: true })
  @IsBoolean()
  required!: boolean;

  @ApiPropertyOptional({ example: ['opt1', 'opt2'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[];
}

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
    type: [FieldDefinitionDto],
    example: [{ key: 'title', type: 'text', label: 'Title', required: true }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDefinitionDto)
  fields!: FieldDefinitionDto[];

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isSingleton?: boolean;
}
