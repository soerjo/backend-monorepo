import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ClientCredentialsDto {
  @ApiProperty({ example: 'svc_0123456789abcdef01234567' })
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @ApiProperty({ example: 'raWbWtv8pOCUY0Qtl-YlU8gp7RVDH9gtOWJU_2NDmJw' })
  @IsString()
  @IsNotEmpty()
  client_secret!: string;
}
