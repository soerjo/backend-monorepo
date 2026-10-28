import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateContentEntryDto } from './create-content-entry.dto.js';
import { IsArray, IsString } from 'class-validator';

export class UpdateContentEntryDto extends PartialType(CreateContentEntryDto) {}

export class UpdateContentTagsDto {
  @ApiProperty({ example: ['tag-uuid-1', 'tag-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  tagIds!: string[];
}
