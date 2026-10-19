/* GENERATED-CONTRACT-SCRIPT
 * Generates contracts/openapi.json by bootstrapping the Nest app WITHOUT
 * listening. Uses the EXACT DocumentBuilder config from src/main.ts
 * (extracted to avoid a second source of truth).
 *
 * NOTE: The application is compiled and bootstrapped using the @nestjs/testing
 * TestingModule to override external dependencies (PrismaService) so that the
 * script can run in a CI environment WITHOUT a live database.
 */
import './env-mock.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig } from '../src/swagger.config.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

async function generateOpenApi(): Promise<void> {
  // Use the TestingModule builder to mock out the PrismaService,
  // ensuring the app can be instantiated without a live DB.
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({
      onModuleInit: async () => Promise.resolve(),
      onModuleDestroy: async () => Promise.resolve(),
      $connect: async () => Promise.resolve(),
      $disconnect: async () => Promise.resolve(),
      enableShutdownHooks: () => undefined,
    })
    .compile();

  const app = moduleRef.createNestApplication({
    logger: false,
    autoFlushLogs: false,
  });

  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  const outPath = resolve(process.cwd(), 'contracts/openapi.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n');

  const pathCount = Object.keys(document.paths ?? {}).length;
  console.log(
    `[docs:openapi] generated ${outPath} — ${pathCount} paths, ${Object.keys(document.components?.schemas ?? {}).length} schemas`,
  );

  await app.close();
}

generateOpenApi().catch((err) => {
  console.error('Failed to generate OpenAPI contract:', err);
  process.exit(1);
});
