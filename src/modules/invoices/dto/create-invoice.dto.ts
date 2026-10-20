import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Target UMS Organization ID',
  })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiProperty({
    example: 150000,
    description: 'Invoice gross amount in IDR',
  })
  @IsNumber()
  @Min(1000)
  amount!: number;

  @ApiProperty({
    example: '2026-10-30T23:59:59.000Z',
    description: 'Due date in ISO-8601 format',
  })
  @IsDateString()
  @IsNotEmpty()
  dueDate!: string;

  @ApiPropertyOptional({
    example: 'Subscription Plan Renewal',
    description: 'Human readable invoice description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: { source: 'pos', orderId: 'ord-123' },
    description: 'Arbitrary context metadata JSON',
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
