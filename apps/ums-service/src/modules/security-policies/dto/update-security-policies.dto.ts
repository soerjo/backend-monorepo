import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateSecurityPolicyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  accessTokenTtlMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  refreshTokenTtlDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxConcurrentSessions?: number;

  @IsOptional()
  @IsBoolean()
  requireMfaForAdmins?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365 * 5)
  enableAuditRetentionDays?: number;

  @IsOptional()
  @IsBoolean()
  allowPasswordReset?: boolean;
}
