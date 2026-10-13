import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
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
  PORT: string = '3000';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRATION: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION: string = '7d';

  @IsString()
  @IsOptional()
  MINIO_ENDPOINT: string = 'localhost';

  @IsPort()
  @IsOptional()
  MINIO_PORT: string = '9000';

  @IsIn(['true', 'false'])
  @IsOptional()
  MINIO_USE_SSL: string = 'false';

  @IsString()
  @IsNotEmpty()
  MINIO_ACCESS_KEY!: string;

  @IsString()
  @IsNotEmpty()
  MINIO_SECRET_KEY!: string;

  @IsString()
  @IsOptional()
  MINIO_BUCKET: string = 'app-uploads';
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
