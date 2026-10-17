import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({ example: 'uuid-of-user' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ enum: ['admin', 'member'], example: 'member' })
  @IsString()
  @IsIn(['admin', 'member'])
  @IsOptional()
  role?: string;
}
