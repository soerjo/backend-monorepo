# AGENTS.md — ums-service

User Management Service: pusat identitas platform `soerjo/*`. **Satu-satunya penerbit access token.**
NestJS 11 + Prisma 6 + PostgreSQL, package manager **bun**.

## Commands

- `bun install` — install (lockfile tunggal `bun.lock`, jangan pakai npm/yarn/pnpm)
- `bun run start:dev` — dev server watch
- `bun run build` — nest build ke `dist/`
- `bun run lint` — eslint flat config
- `bunx tsc --noEmit` — typecheck (tidak ada script khusus)
- `bunx jest --config jest.config.js` — unit test (lihat catatan jest di bawah)
- `bun run test:e2e` — e2e (`RUN_E2E=true`, butuh DB hidup)
- `bunx prisma generate` / `bunx prisma migrate dev` / `bun run seed`

Gate wajib sebelum PR: `bunx tsc --noEmit` + `bun run lint` + `bun run build`, semuanya bersih.

## Peta folder

```
src/
  main.ts                 bootstrap, global prefix /api, Swagger /docs, /metrics (raw Express)
  app.module.ts           global guards: Throttler -> JwtAuthGuard -> RolesGuard
  config/                 env.validation.ts (class-validator), logger.config.ts (winston)
  prisma/                 PrismaModule @Global + PrismaService
  common/
    decorators/           @CurrentUser @Public @Roles
    guards/               jwt-auth.guard, roles.guard (claims-based, tanpa query DB)
    filters/              all-exceptions.filter
    interceptors/         response-transform.interceptor
    middleware/           request-logging.middleware (+ metrics)
    utils/                password.util (argon2id), jwk.util (kid RFC 7638), cookie.util
  modules/
    auth/                 register, login, refresh, logout, logout-all, me, JWKS
    users/ roles/ permissions/ organizations/   admin-gated CRUD
    health/ metrics/
prisma/schema.prisma      9 model + 2 enum
docs/                     dokumentasi Tier-1 (lihat docs/README.md)
docs/platform/PLATFORM.md GENERATED — disinkron dari repo platform-docs, jangan diedit
```

File baru: modul bisnis di `src/modules/<domain>/`, helper lintas modul di `src/common/`.

## Aturan keras

- **bun saja.** Lockfile lain dilarang masuk.
- Semua import memakai ekstensi `.js` (wajib untuk `module: nodenext`).
- Pola modul 3 lapis: Controller (HTTP + decorator) → Service (logika tipis) → Repository (Prisma).
  DTO pakai `class-validator` + decorator Swagger; Update DTO lewat `PartialType(CreateDto)`.
- **Akses token stateless.** `JwtStrategy.validate()` hanya memetakan klaim — dilarang query DB per
  request. `RolesGuard` memeriksa `user.roles`, bukan tabel.
- Private key RS256 tidak pernah keluar dari service ini. Public key + `kid` **diturunkan** dari
  private key, bukan env terpisah.
- Delivery lewat PR; tidak ada push langsung ke `main`.
- Checklist pekerjaan tinggal di GitHub Issues, **bukan** di file ini.

## Routes (prefix `/api`)

- `auth/` — `POST register` · `POST login` (throttle 5/60s) · `POST refresh` · `POST logout` ·
  `POST logout-all` · `GET me`. Tiga yang pertama `@Public()`.
- `.well-known/` — `GET jwks.json` (`@Public()`), dikirim lewat `@Res()` agar tetap berbentuk
  `{ keys: [...] }` dan tidak dibungkus response interceptor.
- `users/` — `GET /` · `GET /:id` · `PATCH /:id` · `POST /:id/roles` — role `ums:admin`
- `roles/` — CRUD + `PUT /:id/permissions` — role `ums:admin`
- `permissions/` — CRUD — role `ums:admin`
- `orgs/` — CRUD + `GET/POST /:id/members` + `DELETE /:id/members/:userId` — role `ums:admin`
- `health/` — `GET /` (`@Public()`)
- `/metrics` — di **luar** prefix `/api`, raw Express handler, melewati guard dan interceptor

Role admin = konstanta `UMS_ADMIN_ROLE = 'ums:admin'` (`src/modules/auth/auth.constants.ts`).

## Model data

`User` · `Session` · `Role` · `Permission` · `RolePermission` · `UserRole` · `Organization` ·
`OrgMember` · `AuthToken`, enum `UserStatus` dan `AuthTokenType`. Detail: `docs/01-data-model.md`.

## Auth

- Password: **argon2id** (`password.util.ts`, memoryCost 19456 / timeCost 2 / parallelism 1).
- Access token: **RS256**, klaim `{ sub, email, name, roles[], orgs[], iss: 'ums-service', azp: 'ums-web' }`,
  header `kid` = JWK thumbprint RFC 7638.
- Refresh token: **opaque** 32-byte base64url, disimpan hanya sebagai SHA-256 di `Session.refreshHash`.
  Rotasi mengisi `replacedByHash` + `revokedAt`; token yang sudah dirotasi dipakai ulang →
  seluruh `family` dicabut.
- Cookie `ums_refresh_token`, path `/api/auth`, `sameSite=lax`, `secure` saat produksi.

## Env

Wajib: `DATABASE_URL`. Kunci: `UMS_JWT_PRIVATE_KEY` atau `UMS_JWT_PRIVATE_KEY_PATH`.
Lainnya opsional dengan default: `NODE_ENV`, `PORT=3000`, `JWT_ACCESS_EXPIRATION=15m`,
`JWT_REFRESH_EXPIRATION=7d`, `CORS_ORIGINS`, `COOKIE_SECURE`, `THROTTLE_TTL_MS=60000`,
`THROTTLE_LIMIT=10`, `UMS_ADMIN_EMAIL/PASSWORD/NAME` (seed).
Daftar lengkap + nilai deployment nyata: `docs/03-operations.md`.

## Utang teknis yang sudah diketahui

- `bun run test` gagal karena konflik konfigurasi jest (`jest.config.js` dan key `jest` di
  `package.json` dua-duanya ada). Jalankan `bunx jest --config jest.config.js`.
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` sudah tidak dipakai (RS256 + refresh opaque) tetapi
  masih ada di `env.validation.ts`.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` masih divalidasi padahal
  Google OAuth sudah dihapus.
- `JWT_REFRESH_EXPIRATION` default `7d`, sementara desain menyebut `30d` — harus di-set eksplisit.
- Belum ada helmet; CORS terbuka bila `CORS_ORIGINS` kosong.
- Cakupan test tipis; e2e bersifat opt-in dan butuh DB hidup.

## Non-goals

- Jangan menerbitkan token di service lain — UMS satu-satunya penerbit.
- Jangan menambah lookup DB di jalur verifikasi token.
- Jangan menyalin dokumentasi platform ke sini; rujuk `docs/platform/PLATFORM.md`.

## Alur SDD

`/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`
→ `/speckit.converge`. Konstitusi repo: `.specify/memory/constitution.md`.
Pekerjaan lintas repo dimulai dari epic di repo `platform-docs`.
