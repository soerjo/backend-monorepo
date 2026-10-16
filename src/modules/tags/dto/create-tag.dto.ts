import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ example: 'nestjs' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ example: 'NestJS' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
