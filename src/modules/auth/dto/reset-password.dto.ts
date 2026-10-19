import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'Xk9f2mQ7pLz3R1vY8wN4aB6cD0eF5gH2', minLength: 1 })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'Str0ng-P@ssw0rd!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
