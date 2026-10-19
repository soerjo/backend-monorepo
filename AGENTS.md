# AGENTS.md — pos-service

Point-of-Sale service. NestJS 11 (Express, single app) + Prisma + PostgreSQL.
Pemilik kontrak untuk konsumen `pos-ui` (auth pusat di `ums-service` — service ini consumer JWT UMS).

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
  common/             guards, decorators (@Public, @CurrentUser), http-client
  prisma/             PrismaService global
  modules/
    health            GET /health (@Public)
    auth              /auth: register, login, google+callback, verify-token,
                      refresh-token, set-password, change-password
    users             /users (list, me, detail)
    organizations     /organizations: list/:id/slug @Public; CUD guarded
    shifts            /v1/shifts: open, cash-movement, close, GET current
    products          /v1/products: list, detail, seed, create, PATCH
    orders            /v1/orders: create, PUT :id/items, hold, GET held,
                      recall, cancel, refund
    payments          /v1/orders/:id/payments (list, create, status, SSE stream)
    webhooks          /v1/webhooks (Midtrans dsb., @Public)
    metrics           internal metrics
    outbox            Kafka producer via outbox pattern
```

## Domain (prisma/schema.prisma)

User, Organization, Shift, CashMovement, Order(+Item, +ItemModifier), Payment, OutboxEvent,
Product(+Modifier), ProcessedEvent, DeadLetterEvent.
Enum: ProductCategory, RoleName, ShiftStatus, OrderStatus, OrderType, PaymentMethod,
PaymentStatus, OutboxStatus, CashMovementType.

## Aturan keras

- **bun saja.** `bun run <script>`, `bunx <binary>`. Import `.js` (module nodenext).
- **Auth pusat di ums-service.** Token diterbitkan UMS (RS256); verifikasi lokal via
  `UMS_JWT_PUBLIC_KEY` / `UMS_JWT_PUBLIC_KEY_PATH`. Jangan menulis penerbitan token sendiri.
- **Grand total order adalah hasil hitung backend** — FE mengirim item, BE menghitung total
  (decimal server-side). Jangan percaya total dari klien.
- ESLint type-aware — jangan melebarkan rule override untuk menutup error.
- Delivery lewat PR; tidak ada push langsung ke `main`. Checklist pekerjaan di GitHub Issues.
- Contract-driven: kontrak HTTP digenerate (Swagger `/docs`), tidak diedit tangan.

## Env (src/config/env.validation.ts, wajib divalidasi)

Wajib: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET` (legacy local-auth fields; jalur aktif: verifikasi JWT UMS).
Opsional: `PORT`, `NODE_ENV`, `JWT_*_EXPIRATION`, `FRONTEND_URL`, `CORS_ORIGINS`,
`UMS_JWT_PUBLIC_KEY`, `UMS_JWT_PUBLIC_KEY_PATH`, `KAFKA_BROKERS`, `KAFKA_CONSUMER_GROUP_ID`,
`MIDTRANS_*` (webhook payment QRIS).
Port deployment nyata dan fakta platform lain: `docs/platform/PLATFORM.md`.

## Utang teknis yang masih benar

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
