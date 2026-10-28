# ums-service — User Management Service (UMS)

<p align="center"><em>NestJS v11 · Prisma v6 · PostgreSQL · RS256 JWT · Refresh rotation + reuse detection</em></p>

**UMS (User Management Service)** adalah layanan identitas terpusat untuk seluruh ekosistem aplikasi Mas Soerjo (bank-sampah, CMS, aplikasi berikutnya). Ia memegang **Authentication** (login/register/session) dan **Authorization kasar** (roles, permissions, organizations); keputusan otorisasi fine-grained tetap di masing-masing BE aplikasi.

> Dokumentasi lengkap ada di [`docs/`](./docs/README.md): PRD, data model (ERD), design patterns, dan operasional.
> Kontrak HTTP digenerate dari Swagger ke `contracts/openapi.json` — jangan ditulis tangan.
> Fakta lintas service ada di [`docs/platform/PLATFORM.md`](./docs/platform/PLATFORM.md) (GENERATED).

## Kemampuan

- **Auth core**: register, login, refresh (rotasi + reuse detection), logout, logout-all, me
- **RBAC**: CRUD Roles + Permissions, klaim `roles[]` & `perms[]` di access token, pemetaan via `PUT /roles/:id/permissions`
- **Organizations**: CRUD org + membership (add/remove/list member)
- **Keamanan**: password argon2id, refresh token opaque 32-byte (disimpan sebagai SHA-256 hash), akses ditolak untuk user BLOCKED + revoke sesi saat block, rate limit configurable
- **Integrasi BE lain**: endpoint **JWKS** publik — semua service lain memverifikasi JWT secara lokal tanpa call ke UMS per request
- **Session cookie**: refresh token dikirim via HttpOnly cookie (path `/` agar terbaca Next.js middleware) DAN body
- **Ops**: health (terminus), metrics prom-client, seed admin idempoten

## Arsitektur

```
                     (1) login/register                      ┌──────────────┐
Client ───────────────────────────────────────────▶ UMS API  │  PostgreSQL  │
       ◀── accessToken (JWT RS256, 15m) + refreshToken ──────┤  Prisma      │
       (2) Bearer ke BE app (CMS, dst)                       └──────────────┘
             BE app memverifikasi JWT secara LOKAL via
             GET /.well-known/jwks.json (public key, ter-cache)

       (3) access token expired → POST /auth/refresh
           refresh dirotasi; pemakaian ulang token lama =
           REUSE DETECTION → revoke seluruh session family
```

## Struktur Proyek

```
src/
  common/                 # guards, decorators, utils
  config/                 # env.validation, logger (winston)
  prisma/                 # PrismaService
  modules/
    auth/                 # register/login/refresh/logout/logout-all/me,
    │                     #   jwks.controller, strategies, session handling
    users/                # list/get/patch/assign-roles (guard ums:admin)
    roles/                # CRUD roles + PUT :id/permissions
    permissions/          # CRUD permissions
    organizations/        # CRUD orgs + members
    health/               # terminus
    metrics/              # prom-client
  main.ts                 # bootstrap, global prefix /api, swagger
prisma/
  schema.prisma           # model data (lihat bawah)
  seed.ts                 # admin idempoten (bun run seed)
```

## Data Model (Prisma)

| Model | Fungsi |
|---|---|
| `User` | identitas — email unique, passwordHash (argon2), status (enum `UserStatus`: ACTIVE/BLOCKED), emailVerifiedAt |
| `Session` | sesi refresh — refreshHash (SHA-256, unique), family, userAgent, ip, expiresAt, revokedAt, replacedByHash |
| `Role` / `UserRole` | role + pemetaan ke user |
| `Permission` / `RolePermission` | permission granular + pemetaan ke role |
| `Organization` / `OrgMember` | organisasi/cabang + keanggotaan |
| `AuthToken` | token verifikasi/reset (enum `AuthTokenType`) |

## API Reference (base `/api`)

Envelope response: `{statusCode, message, data, timestamp, path}`.

### Auth

| Method | Endpoint | Auth | Fungsi |
|---|---|---|---|
| POST | `/auth/register` | public | daftar (email, password, name) |
| POST | `/auth/login` | public | → `{accessToken, refreshToken, user}`; refreshToken juga di-set HttpOnly cookie |
| POST | `/auth/refresh` | cookie/body | rotasi refresh token; reuse terdeteksi → revoke family |
| POST | `/auth/logout` | bearer | revoke session ini + clear cookie |
| POST | `/auth/logout-all` | bearer | revoke semua sesi user |
| GET | `/auth/me` | bearer | profil + roles/permissions |
| GET | `/.well-known/jwks.json` | public | public key JWK untuk BE lain |

### RBAC (guard `ums:admin`)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET/POST/PATCH/DELETE | `/roles`, `/roles/:id` | CRUD role |
| PUT | `/roles/:id/permissions` | set permissions role |
| GET/POST/PATCH/DELETE | `/permissions`, `/permissions/:id` | CRUD permission |

### Users & Organizations (guard `ums:admin`)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/users`, `/users/:id` | list/detail user |
| PATCH | `/users/:id` | update profil/status (block → sesi di-revoke) |
| POST | `/users/:id/roles` | assign role |
| GET/POST/PATCH/DELETE | `/orgs`, `/orgs/:id` | CRUD organization |
| GET/POST/DELETE | `/orgs/:id/members`, `/orgs/:id/members/:userId` | kelola member |

### Ops

| Endpoint | Fungsi |
|---|---|
| `GET /api/health` | terminus |
| `GET /metrics` | Prometheus |

## Access Token — klaim

```json
{
  "sub": "<uuid>",
  "email": "user@example.com",
  "roles": ["ums:admin"],
  "perms": ["users:read"],
  "iss": "ums-service",
  "azp": "ums-web",
  "exp": "<15 menit>"
}
```

> Konsumen BE: verifikasi via JWKS, cek `iss` = `ums-service`, identitas user = `sub`. Jangan validasi `aud` terhadap client id — klaim pembeda client adalah `azp`.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | development / production / test |
| `PORT` | No | `3000` | Server port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_ACCESS_EXPIRATION` | No | `15m` | Access token expiry (`s`/`m`/`h`/`d`) |
| `JWT_REFRESH_EXPIRATION` | No | `30d` | Refresh token expiry |
| `UMS_JWT_PRIVATE_KEY` | Yes* | — | PEM private key inline (literal atau `\n`-escaped) |
| `UMS_JWT_PRIVATE_KEY_PATH` | Yes* | — | Path file PEM — prioritas bila diisi. Public key + JWKS diturunkan otomatis |
| `UMS_ADMIN_EMAIL` / `UMS_ADMIN_PASSWORD` / `UMS_ADMIN_NAME` | seed only | — | Kredensial admin awal (`bun run seed`) |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | No | — | Rate limit configurable |
| `CORS_ORIGINS` | No | — | Origin FE dipisah koma; kosong = allow all (dev) |
| `FRONTEND_URL` | No | — | Base URL FE |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | No | — | OAuth disabled di v1 (opsional, tak dipakai) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | No | — | **Legacy HS256** — tidak dipakai sejak migrasi RS256 + opaque refresh (boleh dihapus) |

*\* Tepat satu dari `UMS_JWT_PRIVATE_KEY` / `UMS_JWT_PRIVATE_KEY_PATH` wajib diisi. Secret tidak pernah di-commit — inject runtime.*

## Menjalankan

```bash
bun install
# siapkan .env (lihat .env.example) + keypair RS256:
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

bunx prisma migrate dev        # dev — terapkan migrasi
bunx prisma migrate deploy     # prod
bun run seed                   # admin idempoten (argon2 hash sebelum upsert)
bun run start:dev

# Gates
bun run lint
bun run test                   # unit (jest)
bun run test:e2e               # e2e
bun run build
```

## Integrasi BE lain (pola yang dipakai my-cms-service)

1. Ambil public key dari `GET /api/.well-known/jwks.json` (atau salin PEM public ke env BE)
2. Verifikasi JWT di guard: signature (JWKS), `iss`, klaim `roles[]`/`perms[]`
3. Tidak ada secret yang disimpan di BE konsumen — public key sifatnya publik
4. Access token pendek (15m) → FE refresh via UMS; BE tidak perlu tahu refresh token

## Deployment

- Dockerfile tersedia; CI GitHub Actions (`build/quality/test`) wajib hijau per PR.
- Deploy produksi via Portainer stack (house rule) di host `soerjo-sever`, network `internal_net`, DB `ums_db` di `postgres_db`.
- Env/secret di Portainer + di-backup ke repo `container-envs` (standing rule).
- Rotasi key JWT: generate keypair baru → ganti env `UMS_JWT_PRIVATE_KEY*` → restart; JWKS otomatis menayangkan key baru, token lama mati alami saat expired.

## Konvensi Kontribusi

- Ship via **PR ke main** — CI hijau sebelum merge; tidak push langsung ke main.
- Selalu mulai dari clone fresh GitHub `main` terbaru; jangan pakai clone lokal basi.
- Perubahan schema Prisma → migration file ter-commit bersama PR-nya.
- Secret tidak pernah masuk repo.

## Terkait

- **my-cms-service** — konsumen JWKS; CMS memverifikasi JWT UMS via public key
- **my-nextjs-template** — basis FE dengan auth system yang mengonsumsi endpoint `/auth/*` di atas
- **docs/** — dokumentasi Tier-1: `00-prd.md`, `01-data-model.md`, `02-patterns.md`, `03-operations.md`
- **docs/platform/PLATFORM.md** — digest Tier-0 platform (GENERATED dari `soerjo/platform-docs`)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).