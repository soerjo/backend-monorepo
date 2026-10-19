import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class CreateIdentityProviderDto {
  @ApiProperty({ example: 'company-google' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'https://accounts.google.com' })
  @IsUrl({ require_tld: false })
  issuer!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  clientId!: string;

  @ApiProperty({
    description: 'Client secret — stored encrypted, never returned',
  })
  @IsString()
  @MinLength(8)
  clientSecret!: string;

  @ApiPropertyOptional({ example: ['openid', 'email', 'profile'] })
  @IsOptional()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
