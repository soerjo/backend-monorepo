import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateContentEntryDto {
  @ApiProperty({ example: 'content-type-uuid-or-key' })
  @IsString()
  @IsNotEmpty()
  contentTypeId!: string;

  @ApiProperty({ example: 'my-article-slug' })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({ example: { title: 'My Article', body: 'Hello world' } })
  @IsObject()
  data!: Record<string, any>;

  @ApiPropertyOptional({ example: 'id' })
  @IsString()
  @IsOptional()
  locale?: string;
}
