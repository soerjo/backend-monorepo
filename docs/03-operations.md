# Operations — ums-service

## Build & run lokal

```bash
bun install
bunx prisma generate
bunx prisma migrate dev
bun run seed
bun run start:dev
```

Gate wajib sebelum PR, ketiganya harus bersih:

```bash
bunx tsc --noEmit
bun run lint
bun run build
```

Unit test: `bunx jest --config jest.config.js`.
E2E: `RUN_E2E=true bun run test:e2e` (butuh database hidup).

> `bun run test` **gagal** karena `jest.config.js` dan key `jest` di `package.json` dua-duanya ada.
> Pakai perintah ber-config eksplisit di atas sampai konflik itu dibereskan.

## Environment variables

Wajib:
- `DATABASE_URL` — connection string PostgreSQL

Kunci penandatangan (salah satu wajib ada):
- `UMS_JWT_PRIVATE_KEY` — isi PEM langsung
- `UMS_JWT_PRIVATE_KEY_PATH` — path ke file PEM

Opsional, punya default:
- `NODE_ENV` (`development`) · `PORT` (`3000`)
- `JWT_ACCESS_EXPIRATION` (`15m`) · `JWT_REFRESH_EXPIRATION` (`7d`)
- `CORS_ORIGINS` — kosong berarti **semua origin diizinkan**
- `COOKIE_SECURE` · `THROTTLE_TTL_MS` (`60000`) · `THROTTLE_LIMIT` (`10`)
- `UMS_ADMIN_EMAIL` / `UMS_ADMIN_PASSWORD` / `UMS_ADMIN_NAME` — dipakai seed

Masih divalidasi tetapi **tidak lagi dipakai** (utang teknis):
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_CALLBACK_URL`, `FRONTEND_URL`.

> `.env.example` di repo ini masih memakai nilai template (`PORT=3000`, `my_db`) dan **tidak**
> mencerminkan deployment nyata.

## Deployment

- Host: `soerjo-sever`, container Docker dikelola Portainer.
- Port host **3500** → port internal container.
- Database `ums_db` pada instance `postgres_db` (`:5432`) yang dipakai bersama 7 service.
- Swagger UI: `/docs`. Health: `GET /api/health`. Metrik Prometheus: `GET /metrics`
  (di luar prefix `/api`).
- Observability: Prometheus + Grafana (`:3001`), dashboard `docker/grafana/dashboards/nestjs-overview.json`.

Topologi lengkap: `docs/platform/PLATFORM.md`.

## Catatan operasional

- `JWT_REFRESH_EXPIRATION` default `7d`, sementara desain menyebut `30d`. Set eksplisit di `.env`.
- Tanpa `CORS_ORIGINS`, CORS terbuka untuk semua origin — tidak layak produksi.
- Belum ada helmet / security header.
- Belum ada prosedur backup/restore PostgreSQL yang terdokumentasi, padahal satu instance melayani
  tujuh service.
- Private key RS256 tidak boleh masuk repo. Pakai `UMS_JWT_PRIVATE_KEY_PATH` dengan file yang
  di-mount, bukan nilai literal di `docker-compose.yml`.
