import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

const runE2e = process.env.RUN_NOTIFICATIONS_E2E === 'true';
const describeE2e = runE2e ? describe : describe.skip;

describeE2e('Notifications ingestion (e2e)', () => {
  let app: INestApplication<App>;

  const token = process.env.INTERNAL_API_TOKEN ?? 'test-internal-token';

  const payload = {
    idempotency_key: `e2e-${Date.now()}`,
    recipient_id: 'usr_e2e',
    channels: ['SOCKET_IO'],
    destination: { socket_room: 'room_usr_e2e' },
    content: { title: 'E2E', body: 'Hello from e2e' },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects ingestion without the internal token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/notifications/send')
      .send(payload)
      .expect(401);
  });

  it('accepts ingestion with the internal token and returns notification ids', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/notifications/send')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(202);

    const body = response.body as {
      data?: { notification_ids?: unknown; trace_id?: unknown };
    };
    expect(body.data?.notification_ids).toHaveLength(1);
    expect(body.data?.trace_id).toBeDefined();
  });
});
