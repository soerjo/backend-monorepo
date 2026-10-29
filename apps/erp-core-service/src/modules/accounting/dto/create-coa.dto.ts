import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';

export class CreateCoaDto {
  @ApiProperty({ description: 'Account Code (e.g. 11100)', example: '11100' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Account Name', example: 'Kas & Setara Kas' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.ASSET })
  @IsEnum(AccountType)
  @IsNotEmpty()
  type: AccountType;

  @ApiPropertyOptional({ description: 'Parent COA UUID if hierarchical' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
