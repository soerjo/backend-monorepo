import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateWebhookEndpointDto {
  @ApiProperty({ example: 'https://consumer.example.com/hooks/ums' })
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  url!: string;

  @ApiProperty({
    type: [String],
    example: ['user.password_reset_completed'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events!: string[];

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
