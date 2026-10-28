import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'pesanggrahan' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Bank sampah cabang pesanggrahan' })
  @IsString()
  @IsOptional()
  description?: string;
}
