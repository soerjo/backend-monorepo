import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CreateRoleDto } from './create-role.dto.js';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {
  @ApiPropertyOptional({ example: 'content:manager' })
  @IsString()
  @MinLength(1)
  @IsOptional()
  override name?: string;
}
