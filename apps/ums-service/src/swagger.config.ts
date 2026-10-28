import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Single source of truth for the OpenAPI/Swagger configuration.
 * Consumed by:
 *   - src/main.ts (serving interactive docs)
 *   - scripts/generate-openapi.ts (generating contracts/openapi.json)
 *
 * DO NOT define a second DocumentBuilder elsewhere — update this file only.
 */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
}
