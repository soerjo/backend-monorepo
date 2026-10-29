import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntrySource } from '@prisma/client';

export class CreateJournalLineDto {
  @ApiProperty({ description: 'Account code corresponding to ChartOfAccount' })
  @IsString()
  @IsNotEmpty()
  accountCode: string;

  @ApiPropertyOptional({ description: 'Line memo / description' })
  @IsString()
  @IsOptional()
  lineDescription?: string;

  @ApiProperty({ description: 'Debit amount', example: 1000000 })
  @IsNumber()
  @Min(0)
  debit: number;

  @ApiProperty({ description: 'Credit amount', example: 0 })
  @IsNumber()
  @Min(0)
  credit: number;
}

export class CreateJournalEntryDto {
  @ApiProperty({
    description: 'Entry date (YYYY-MM-DD)',
    example: '2026-10-29',
  })
  @IsDateString()
  @IsNotEmpty()
  entryDate: string;

  @ApiProperty({ enum: EntrySource, example: EntrySource.BILLING_INVOICE })
  @IsEnum(EntrySource)
  @IsNotEmpty()
  source: EntrySource;

  @ApiPropertyOptional({
    description: 'Reference ID from external service',
    example: 'INV-2026-10928',
  })
  @IsString()
  @IsOptional()
  referenceId?: string;

  @ApiPropertyOptional({
    description: 'Journal memo / summary',
    example: 'Pencatatan pendapatan dari Billing Service',
  })
  @IsString()
  @IsOptional()
  memo?: string;

  @ApiProperty({ type: [CreateJournalLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines: CreateJournalLineDto[];
}
