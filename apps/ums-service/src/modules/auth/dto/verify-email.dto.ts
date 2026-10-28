import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'Xk9f2mQ7pLz3R1vY8wN4aB6cD0eF5gH2', minLength: 1 })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
