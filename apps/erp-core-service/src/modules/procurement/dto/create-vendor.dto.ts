import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVendorDto {
  @ApiProperty({ description: 'Vendor unique code', example: 'VEND-001' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Vendor company name',
    example: 'PT Sumber Makmur Sejahtera',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'procurement@sumbermakmur.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+6281234567890' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Jl. Industri No. 45, Jakarta Barat' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: '01.234.567.8-901.000' })
  @IsString()
  @IsOptional()
  taxNumber?: string;
}
