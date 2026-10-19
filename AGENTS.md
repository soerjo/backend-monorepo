# AGENTS.md — wms-service

Warehouse Management System service. NestJS 11 (Express, single app) + Prisma + PostgreSQL.
Pemilik kontrak untuk konsumen `wms-ui` (auth pusat di `ums-service` — service ini consumer JWT UMS).

## Commands

- `bun install` — install (lockfile `bun.lock`; CI memakai `--frozen-lockfile`)
- `bun run build` — nest build ke `dist/`
- `bun run start:dev` — dev server (port `PORT`, default 3000)
- `bun run lint` — eslint auto-fix (flat config `eslint.config.mjs`, type-aware)
- `bunx eslint "src/**/*.ts" "test/**/*.ts"` — lint check-only (persis perintah CI)
- `bunx tsc --noEmit` — typecheck (tidak ada script khusus)
- `bun run test` — jest unit (`src/**/*.spec.ts`)
- `bun run test:e2e` — e2e (`test/**/*.e2e-spec.ts`, config `test/jest-e2e.json`)
- `bunx prisma generate` / `bunx prisma migrate dev` / `bunx prisma migrate deploy`

Gate wajib sebelum PR (raw output dilampirkan): lint check-only + `bunx tsc --noEmit` + build + test.

## Peta folder

```
src/
  main.ts             bootstrap + global pipes/filters + Swagger (/docs)
  app.module.ts       root; global guards: Throttler, JwtAuthGuard, RolesGuard
  config/env.validation.ts   class-validator env (fail fast)
  common/             guards (jwt/roles/local/google), decorators (@Public, @Roles, @CurrentUser),
                      http-client, utils (ums-jwt-key.util)
  prisma/             PrismaService global
  modules/
    health            GET /health (@Public)
    auth              /auth: register, login (local), google+callback, verify-token,
                      refresh-token, set-password, logout, logout-all
    users             /users: GET me, list, :id, PATCH, DELETE
    organizations     /organizations: list/:id/slug @Public; CUD guarded
    warehouses        /v1/warehouses CRUD
    storage-bins      /v1/warehouses/:warehouseId/bins + /v1/bins
    inventory         /v1/inventory (read)
    inbound           /v1/inbound
    transfers         /v1/transfers (create, dispatch, receive, bin-transfer)
    adjustments       /v1/inventory/adjustments (create, approve)
    metrics           internal metrics
    pos-consumer      Kafka consumer event POS + /v1/dev/pos-event (dev helper)
```

## Domain (prisma/schema.prisma)

User, Organization, Warehouse, StorageBin, ProductStock, StockLedger, InboundShipment(+Item),
StockTransfer(+Item), StockAdjustment(+Item), ProcessedEvent, DeadLetterEvent.
Enum: RoleName, WarehouseType, StorageBinStatus, StockLedgerRefType, InboundShipmentStatus,
StockTransferStatus, StockAdjustmentReason, StockAdjustmentStatus.

## Aturan keras

- **bun saja.** `bun run <script>`, `bunx <binary>`. Import `.js` (module nodenext).
- **Auth pusat di ums-service.** Token diterbitkan UMS (RS256); verifikasi lokal via
  `UMS_JWT_PUBLIC_KEY` / `UMS_JWT_PUBLIC_KEY_PATH`. Jangan menulis penerbitan token sendiri.
- ESLint type-aware (`projectService: true`) — error typecheck bisa muncul sebagai lint error;
  jangan melebarkan rule override untuk menutup error.
- Delivery lewat PR; tidak ada push langsung ke `main`. Checklist pekerjaan di GitHub Issues,
  bukan di file ini.
- Contract-driven: kontrak HTTP digenerate (`SwaggerModule`, di-expose `/docs`), tidak diedit tangan.

## Env (src/config/env.validation.ts, wajib divalidasi)

Wajib: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET` (legacy local-auth fields; jalur aktif: verifikasi JWT UMS).
Opsional: `PORT` (3000), `NODE_ENV`, `JWT_*_EXPIRATION` (15m/7d), `GOOGLE_CALLBACK_URL`,
`FRONTEND_URL`, `CORS_ORIGINS`, `WMS_APPROVAL_THRESHOLD` (0), `WMS_DEV_EVENT_ENDPOINT` (0),
`UMS_JWT_PUBLIC_KEY`, `UMS_JWT_PUBLIC_KEY_PATH`, `KAFKA_BROKERS`, `KAFKA_CONSUMER_GROUP_ID`,
`KAFKA_CONSUMER_DISABLED`.
Port deployment nyata dan fakta platform lain: `docs/platform/PLATFORM.md`.

## Utang teknis yang masih benar

- `common/constants` ROLES didefinisikan tapi tak terpakai (role hardcode string).
- `bun run lint` memakai auto-fix — untuk gate, pakai lint check-only persis perintah CI.
- `test/app.e2e-spec.ts` ikut tertarik unit run (`testRegex .spec.ts$`) dan butuh DB jalan —
  jalankan e2e via config eksplisit `test/jest-e2e.json`.

## Non-goals

- Jangan menambah penerbitan token lokal di samping UMS.
- Jangan menulis ulang kontrak HTTP manual; Swagger digenerate dari kode.

## Alur SDD

`/speckit.specify` -> `/speckit.clarify` -> `/speckit.plan` -> `/speckit.tasks` -> `/speckit.implement`
-> `/speckit.converge`. Konstitusi repo: `.specify/memory/constitution.md` (kalau sudah dibootstrap).
Pekerjaan lintas repo dimulai dari epic di repo `platform-docs`.
