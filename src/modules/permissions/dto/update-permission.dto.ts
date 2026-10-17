import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CreatePermissionDto } from './create-permission.dto.js';

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {
  @ApiPropertyOptional({ example: 'users:read' })
  @IsString()
  @MinLength(1)
  @IsOptional()
  override name?: string;
}
