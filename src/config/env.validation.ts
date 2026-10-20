import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPort,
  IsString,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsPort()
  @IsOptional()
  PORT: string = '3504';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  // UMS Stateless RS256 JWT Verification
  @IsString()
  @IsOptional()
  UMS_JWT_PUBLIC_KEY?: string;

  @IsString()
  @IsOptional()
  UMS_JWT_PUBLIC_KEY_PATH?: string;

  // Midtrans Payment Gateway
  @IsString()
  @IsOptional()
  MIDTRANS_SERVER_KEY?: string;

  @IsString()
  @IsOptional()
  MIDTRANS_CLIENT_KEY?: string;

  @IsBoolean()
  @IsOptional()
  MIDTRANS_IS_PRODUCTION: boolean = false;

  // Kafka Event Broker
  @IsString()
  @IsOptional()
  KAFKA_BROKERS: string = 'kafka:29092';

  @IsString()
  @IsOptional()
  KAFKA_CLIENT_ID: string = 'billing-service';

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validated;
}
