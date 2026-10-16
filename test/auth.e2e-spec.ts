import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { validate } from '../src/config/env.validation.js';

// Opt-in only: requires a live database and RS256 key env. Run with
// `RUN_E2E=true bun run test:e2e`.
const RUN_E2E = process.env.RUN_E2E === 'true';
const describeE2e = RUN_E2E ? describe : describe.skip;

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: { email: string };
}

describeE2e('Auth flow (e2e)', () => {
  let app: INestApplication<App>;
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'SuperSecret123';

  beforeAll(async () => {
    // Imported lazily so a skipped run never evaluates AppModule (its
    // ConfigModule.forRoot validates env at import time).
    const { AppModule } = await import('./../src/app.module.js');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate, load: [] }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs in, refreshes (rotates) and logs out', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/api/auth/register')
      .send({ email, password, name: 'E2E User' })
      .expect(201);

    const login = await request(server)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const loginBody = login.body as TokenResponse;
    expect(loginBody.accessToken).toBeDefined();
    expect(loginBody.refreshToken).toBeDefined();
    expect(loginBody.user.email).toBe(email);

    const refresh = await request(server)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginBody.refreshToken })
      .expect(200);

    const refreshBody = refresh.body as TokenResponse;
    expect(refreshBody.refreshToken).toBeDefined();
    expect(refreshBody.refreshToken).not.toBe(loginBody.refreshToken);

    await request(server)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${refreshBody.accessToken}`)
      .send({ refreshToken: refreshBody.refreshToken })
      .expect(200);

    // Rotated-then-logged-out token must be rejected.
    await request(server)
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshBody.refreshToken })
      .expect(401);
  });
});
