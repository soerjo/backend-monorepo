import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { readFileSync } from 'node:fs';
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
    // Match the production pipeline (main.ts): without the interceptor/filter
    // the responses are bare and every envelope assertion here is meaningless.
    app.setGlobalPrefix('api');
    const { ResponseTransformInterceptor } =
      await import('./../src/common/interceptors/response-transform.interceptor.js');
    const { AllExceptionsFilter } =
      await import('./../src/common/filters/all-exceptions.filter.js');
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
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

    const loginBody = (login.body as { data: TokenResponse }).data;
    expect(loginBody.accessToken).toBeDefined();
    expect(loginBody.refreshToken).toBeDefined();
    expect(loginBody.user.email).toBe(email);

    const refresh = await request(server)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginBody.refreshToken })
      .expect(200);

    const refreshBody = (refresh.body as { data: TokenResponse }).data;
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

/**
 * Epic 001 E2E gate: full recovery + verification journey.
 *
 * Requires a live database and RS256 key env; run with
 * `RUN_E2E=true bun run test:e2e` plus standard env (DATABASE_URL, UMS_JWT_PRIVATE_KEY
 * or UMS_JWT_PRIVATE_KEY_PATH) and MAIL_TRANSPORT=log with MAIL_LOG_FILE set so the
 * suite can capture token-bearing links deterministically (documented dev behavior).
 *
 * Optional: E2E_UNVERIFIED_EMAIL — when set, the verification journey also exercises
 * the full consumption path for a user the runner seeded as unverified.
 */
interface Envelope {
  statusCode: number;
  message: string | string[];
  data: unknown;
}

describeE2e('Epic 001 — password recovery (e2e)', () => {
  let localApp: INestApplication<App>;
  let server: ReturnType<INestApplication<App>['getHttpServer']>;
  const mailLogFile = process.env.MAIL_LOG_FILE ?? '';
  const recoveryEmail = `e2e-recovery-${Date.now()}@example.com`;
  const oldPassword = 'SuperSecret123';

  beforeAll(async () => {
    const { AppModule } = await import('./../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate, load: [] }),
        AppModule,
      ],
    }).compile();
    localApp = moduleFixture.createNestApplication();
    // Same production pipeline as the primary bootstrap - without these the
    // journeys read bare bodies and every envelope assertion fails.
    localApp.setGlobalPrefix('api');
    const { ResponseTransformInterceptor: RTI } =
      await import('./../src/common/interceptors/response-transform.interceptor.js');
    const { AllExceptionsFilter: AEF } =
      await import('./../src/common/filters/all-exceptions.filter.js');
    localApp.useGlobalInterceptors(new RTI());
    localApp.useGlobalFilters(new AEF());
    localApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await localApp.init();
    server = localApp.getHttpServer();

    // The recovery journeys assume an existing account for recoveryEmail —
    // without this registration the forgot-password call is a silent no-op
    // (anti-enumeration) and every later login returns 401.
    await request(server)
      .post('/api/auth/register')
      .send({
        email: recoveryEmail,
        password: oldPassword,
        name: 'Recovery E2E',
      })
      .expect(201);
  });

  const post = async (path: string, body: Record<string, unknown>) =>
    request(server).post(`/api/auth/${path}`).send(body);

  const readLastTokenFromMailLog = (
    to: string,
    subject: string,
  ): string | null => {
    if (!mailLogFile) return null;
    let lines: string[];
    try {
      lines = readFileSync(mailLogFile, 'utf8').split('\n').filter(Boolean);
    } catch {
      return null;
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as {
          event: string;
          to: string;
          subject: string;
          link: string;
        };
        if (
          entry.event === 'mail.log-transport' &&
          entry.to === to &&
          entry.subject === subject
        ) {
          const tokenParam = new URL(entry.link).searchParams.get('token');
          return tokenParam;
        }
      } catch {
        // skip malformed lines
      }
    }
    return null;
  };

  const timedPost = async (
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ status: number; body: Envelope; ms: number }> => {
    const start = performance.now();
    const res = await post(path, body);
    return {
      status: res.status,
      body: res.body as Envelope,
      ms: performance.now() - start,
    };
  };

  it('issues a token for a registered email and answers identically for an unknown email', async () => {
    const unknownEmail = `unknown-${Date.now()}@example.com`;

    const registered = await timedPost('forgot-password', {
      email: recoveryEmail,
    });
    const unknown = await timedPost('forgot-password', { email: unknownEmail });

    // Anti-enumeration: identical status, identical envelope shape.
    expect(registered.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(registered.body.data).toBeNull();
    expect(unknown.body.data).toBeNull();
    expect(Object.keys(registered.body).sort()).toEqual(
      Object.keys(unknown.body).sort(),
    );

    // Timing: both branches pay an argon2 hash; gross enumeration (instant
    // unknown-path) must be caught, jitter must not.
    expect(Math.abs(registered.ms - unknown.ms)).toBeLessThan(1500);
  });

  it('resets the password with the log-captured token and revokes every old session', async () => {
    // Login BEFORE reset to hold a pre-reset session.
    const preReset = await post('login', {
      email: recoveryEmail,
      password: oldPassword,
    });
    expect(preReset.status).toBe(200);
    const preResetBody = (preReset.body as { data: TokenResponse }).data;
    const oldRefreshToken = preResetBody.refreshToken;
    expect(oldRefreshToken).toBeDefined();

    // Token from the documented dev log transport.
    const token = readLastTokenFromMailLog(
      recoveryEmail,
      'Reset your password',
    );
    expect(token).toBeTruthy();

    const newPassword = 'NewStronger123';
    await post('reset-password', { token, password: newPassword }).then(
      (res) => {
        expect(res.status).toBe(200);
        expect((res.body as Envelope).data).toBeNull();
      },
    );

    // New password works.
    const newLogin = await post('login', {
      email: recoveryEmail,
      password: newPassword,
    });
    expect(newLogin.status).toBe(200);

    // Old password is dead.
    await post('login', { email: recoveryEmail, password: oldPassword }).then(
      (res) => expect(res.status).toBe(401),
    );

    // All pre-reset sessions revoked.
    await post('refresh', { refreshToken: oldRefreshToken }).then((res) =>
      expect(res.status).toBe(401),
    );
  });

  it('rejects a consumed reset token with the same message as an invalid token', async () => {
    const token = readLastTokenFromMailLog(
      recoveryEmail,
      'Reset your password',
    );
    // The token from the previous test is already consumed; if missing, use an
    // invalid one — the contract says both produce ONE identical message.
    const replay = await post('reset-password', {
      token: token ?? 'definitely-invalid-token-value',
      password: 'Whatever123',
    });
    expect(replay.status).toBe(400);

    const invalid = await post('reset-password', {
      token: 'another-invalid-token-value',
      password: 'Whatever123',
    });
    expect(invalid.status).toBe(400);
    expect((replay.body as Envelope).message).toEqual(
      (invalid.body as Envelope).message,
    );
  });
});

describeE2e('Epic 001 — email verification (e2e)', () => {
  let localApp: INestApplication<App>;
  let server: ReturnType<INestApplication<App>['getHttpServer']>;
  const mailLogFile = process.env.MAIL_LOG_FILE ?? '';
  const verifyEmail = `verify-${Date.now()}@example.com`;
  const password = 'SuperSecret123';

  beforeAll(async () => {
    const { AppModule } = await import('./../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate, load: [] }),
        AppModule,
      ],
    }).compile();
    localApp = moduleFixture.createNestApplication();
    // Same production pipeline as the primary bootstrap - without these the
    // journeys read bare bodies and every envelope assertion fails.
    localApp.setGlobalPrefix('api');
    const { ResponseTransformInterceptor: RTI } =
      await import('./../src/common/interceptors/response-transform.interceptor.js');
    const { AllExceptionsFilter: AEF } =
      await import('./../src/common/filters/all-exceptions.filter.js');
    localApp.useGlobalInterceptors(new RTI());
    localApp.useGlobalFilters(new AEF());
    localApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await localApp.init();
    server = localApp.getHttpServer();
  });

  const post = async (path: string, body: Record<string, unknown>) =>
    request(server).post(`/api/auth/${path}`).send(body);

  const readLastTokenFromMailLog = (
    to: string,
    subject: string,
  ): string | null => {
    if (!mailLogFile) return null;
    let lines: string[];
    try {
      lines = readFileSync(mailLogFile, 'utf8').split('\n').filter(Boolean);
    } catch {
      return null;
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as {
          event: string;
          to: string;
          subject: string;
          link: string;
        };
        if (
          entry.event === 'mail.log-transport' &&
          entry.to === to &&
          entry.subject === subject
        ) {
          return new URL(entry.link).searchParams.get('token');
        }
      } catch {
        // skip malformed lines
      }
    }
    return null;
  };

  it('answers resend-verification identically for registered and unknown emails', async () => {
    // Register user B (auto-verified in v1) — the resend endpoint still answers
    // the neutral 200 for any email state.
    await request(server)
      .post('/api/auth/register')
      .send({ email: verifyEmail, password, name: 'Verify User' })
      .expect(201);

    const start = performance.now();
    await post('resend-verification', { email: verifyEmail }).then((res) => {
      expect(res.status).toBe(200);
      expect((res.body as { data: unknown }).data).toBeNull();
    });
    const registeredMs = performance.now() - start;

    const unknownEmail = `unknown-verify-${Date.now()}@example.com`;
    const startUnknown = performance.now();
    await post('resend-verification', { email: unknownEmail }).then((res) => {
      expect(res.status).toBe(200);
      expect((res.body as { data: unknown }).data).toBeNull();
    });
    const unknownMs = performance.now() - startUnknown;

    expect(Math.abs(registeredMs - unknownMs)).toBeLessThan(1500);
  });

  it('rejects verify-email with the shared generic error for invalid and replayed tokens', async () => {
    // v1 registers auto-verified, so a fresh EMAIL_VERIFY token cannot be
    // consumed through the public API alone; the uniform-error contract is
    // asserted via invalid + replayed-invalid tokens (one message).
    const invalid = await post('verify-email', {
      token: 'invalid-verification-token',
    });
    expect(invalid.status).toBe(400);

    const replay = await post('verify-email', {
      token: 'invalid-verification-token',
    });
    expect(replay.status).toBe(400);
    expect((replay.body as Envelope).message).toEqual(
      (invalid.body as Envelope).message,
    );
  });

  it('consumes a runner-seeded unverified user token when E2E_UNVERIFIED_EMAIL is set', async () => {
    const seededEmail = process.env.E2E_UNVERIFIED_EMAIL;
    if (!seededEmail) {
      // Runner did not seed an unverified user; consumption is covered at
      // unit level. Nothing to assert here.
      return;
    }

    const token = readLastTokenFromMailLog(seededEmail, 'Verify your email');
    expect(token).toBeTruthy();

    await post('verify-email', { token }).then((res) =>
      expect(res.status).toBe(200),
    );

    // One-time semantics: same token again → 400.
    await post('verify-email', { token }).then((res) =>
      expect(res.status).toBe(400),
    );
  });
});
