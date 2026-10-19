import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class MfaConfirmDto {
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code!: string;
}

export class MfaDisableDto {
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  password!: string;
}

export class MfaChallengeDto {
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}
