# AGENTS.md — my-nestjs-template

Template backend NestJS 11 + Prisma 6 + PostgreSQL, package manager **bun**.
Ini adalah **template dasar** — repositori service (`ums-service`, `wms-service`, `pos-service`,
`my-cms-service`, `notification-service`, `routing-service`, `minio-file-service`) diturunkan dari sini.

## Commands

- `bun install` — install (lockfile tunggal `bun.lock`, dilarang npm/yarn/pnpm)
- `bun run start:dev` — dev server watch
- `bun run build` — nest build ke `dist/`
- `bun run lint` — eslint check-only (flat config)
- `bunx tsc --noEmit` — typecheck (tidak ada script khusus)
- `bunx jest --config jest.config.js` — unit test (Jest v30)
- `bunx prisma generate` / `bunx prisma migrate dev` / `bunx prisma migrate deploy`

Gate wajib sebelum PR: `bunx tsc --noEmit` + `bun run lint` + `bun run build`, semuanya bersih.

> **Utang yang diketahui:** `bun run test` gagal karena `jest.config.js` dan key `jest` di
> `package.json` dua-duanya ada. Jalankan dengan `--config jest.config.js` eksplisit.

## Key facts

- TypeScript `module: nodenext` (wajib: **semua import pakai ekstensi `.js`**), target ES2023
- ESLint `projectService: true` — error typecheck bisa muncul sebagai error lint
- `@typescript-eslint/no-explicit-any` off; `no-floating-promises`, `no-unsafe-argument` warn
- Prettier: single quotes, trailing commas
- Helmet aktif di `main.ts`; CORS mengikuti `CORS_ORIGINS` (kosong = izinkan semua, dev saja)

## Peta folder

```
src/
  main.ts              bootstrap, prefix /api, Swagger /docs, helmet, /metrics (raw Express)
  app.module.ts        global guards: Throttler -> JwtAuthGuard -> RolesGuard
  config/              env.validation.ts (class-validator, fail-fast), logger.config.ts (winston)
  prisma/              PrismaModule @Global + PrismaService
  common/
    decorators/        @CurrentUser @Public @Roles
    guards/            jwt-auth.guard, roles.guard
    filters/           all-exceptions.filter
    interceptors/      response-transform.interceptor
    middleware/        request-logging.middleware (+ metrics)
    utils/             token-expiry.util, cors-origins.util
  modules/
    auth/              register, login, google OAuth, refresh-token, set/change-password,
                       verify-token; local + google + jwt strategies
    users/ organizations/ health/ metrics/
prisma/schema.prisma   2 model: User, Organization
```

File baru: modul bisnis di `src/modules/<domain>/`, helper lintas modul di `src/common/`.

## Aturan keras

- **bun saja.** Lockfile lain dilarang masuk.
- Pola modul **3 lapis**: Controller (HTTP + decorator) → Service (logika tipis) → Repository
  (satu-satunya tempat query Prisma, lempar `NotFoundException`).
- DTO: Create pakai `class-validator` + decorator Swagger; Update via `PartialType(CreateDto)`.
- Route di bawah prefix `/api`; `GET /metrics` adalah pengecualian sadar (raw Express handler,
  di luar prefix/guard/interceptor — Prometheus butuh format mentah).
- Env **wajib dideklarasikan** di `src/config/env.validation.ts` — env tak terdeklarasi tidak
  terlihat oleh `ConfigService`.
- Delivery lewat PR; tidak ada push langsung ke `main`.
- Checklist pekerjaan tinggal di GitHub Issues, **bukan** di file ini.

## Response envelope

- Sukses dibungkus `ResponseTransformInterceptor`: `{ statusCode, message, data, timestamp, path }`
- Error dinormalkan `AllExceptionsFilter`: `{ statusCode, message, errors?, timestamp, path }`

## Env utama

Wajib: `DATABASE_URL`. Kunci: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
Opsional berdefault: `NODE_ENV`, `PORT=3000`, `JWT_ACCESS_EXPIRATION=15m`, `JWT_REFRESH_EXPIRATION=7d`,
`CORS_ORIGINS`, `GOOGLE_*`, `FRONTEND_URL`.
Nama env harus konsisten — jangan menambah varian (`UMS_*`, `APP_*`) tanpa alasan.

## Utang teknis yang diketahui

- Konflik konfigurasi jest (di atas).
- Kontras `.example.env` legacy yang menampung nama env basi — gunakan `.env.example`.
- Auth masih HS256 + bcrypt; `ums-service` sudah pindah ke RS256 + argon2id + refresh opaque —
  migrasi pola itu ke template belum dilakukan.
- `User.isActive` ada tapi tidak pernah dicek di login/strategy.
- `CreateRoleDto.organizationId` tidak terpakai.

## Alur SDD

Template ini sudah dilengkapi **Spec Kit** (integrasi agent `omp`).
`/speckit.constitution` sekali per repo baru, lalu per fitur:
`/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`
→ `/speckit.converge`. Konstitusi platform yang diwarisi: repo `soerjo/platform-docs`.
