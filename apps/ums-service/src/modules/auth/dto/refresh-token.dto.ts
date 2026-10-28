import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Opaque refresh token. Optional when supplied via the HttpOnly cookie.',
    example: 'pFq7...opaque-token',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
