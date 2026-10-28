# my-cms-service — Content Management System API

<p align="center"><em>NestJS v11 · Prisma v6 · PostgreSQL · MinIO (via minio-file-service) · Auth delegasi ke UMS</em></p>

Standalone **CMS backend** untuk ekosistem aplikasi Mas Soerjo: mengelola **content types, content entries (dengan versioning), categories, tags, dan media assets** — plus **Delivery API publik** untuk dibaca aplikasi frontend.

> Filosofi arsitektur: CMS tidak mengelola user/password sendiri — identitas & role datang dari klaim JWT RS256 yang diterbitkan **ums-service** (diverifikasi via public key), dan file binary disimpan oleh **minio-file-service**. CMS fokus murni pada konten.

## Arsitektur

```
            JWT RS256 (sub, roles[], perms[] — diterbitkan UMS)
Client ─────────────────────────────────────────────▶ CMS API (/api)
     │                                                  │
     │   ┌──────────────┐   ┌───────────────────────┐   │
     │   │ Management:  │   │ Media                 │   │
     │   │  content-    │   │  └── proxy ──▶ minio-file-service
     │   │  types/      │   │      (upload/URL/delete)  │
     │   │  entries/    │   └───────────────────────┘   │
     │   │  categories/ │                               │
     │   │  tags/       │   ┌───────────────────────┐   │
     │   └──────────────┘   │ Delivery v1 (PUBLIC)  │   │
     │                      │  konten published     │   │
     │                      └───────────────────────┘   │
     ▼                                                  ▼
 PostgreSQL (Prisma)                        /metrics (prom-client), /health
```

## Struktur Proyek

```
src/
  common/                 # jwt-auth module, guards (JWT + Roles), decorators
  │                         (Public, Roles, CurrentUser), ResponseTransformInterceptor
  │                         (envelope {statusCode,message,data,timestamp,path}),
  │                         all-exceptions filter, request-logging, ums-jwt-key util
  config/                 # env.validation.ts (class-validator), logger.config.ts (winston)
  prisma/                 # PrismaService + module
  modules/
    content-types/        # definisi skema konten dinamis (CRUD)
    content/              # entries + draft/publish/archive + versioning/restore + tags
    categories/           # kategori (hierarki)
    tags/                 # tag (many-to-many ke entries via ContentTag)
    media/                # media assets + file-service.client (proxy minio-file-service)
    delivery/             # Delivery API v1 — read-only publik untuk FE
    health/               # terminus + prisma indicator
    metrics/              # prom-client
  main.ts                 # bootstrap: global prefix /api, pipes, filter, interceptor, swagger
```

Pola tiap modul: `controller → service → repository → Prisma`, DTO `class-validator`, dokumentasi endpoint via `@nestjs/swagger`.

## Data Model (Prisma)

| Model | Fungsi |
|---|---|
| `ContentType` | definisi skema konten dinamis (mis. `article`, `page`) |
| `ContentEntry` | entri konten milik satu type; status via enum `ContentStatus` (draft/publish/archive) |
| `ContentVersion` | snapshot perubahan entri (versioning + restore) |
| `Category` | kategori konten |
| `Tag` / `ContentTag` | tag + join many-to-many ke entri |
| `MediaAsset` | metadata media (file fisik di minio-file-service) |

## API Reference

Response selalu dibungkus envelope konsisten: `{statusCode, message, data, timestamp, path}`.

### Management (auth JWT wajib) — prefix `/api`

| Endpoint | Fungsi |
|---|---|
| `/api/content-types` (+`:id`) | CRUD definisi content type |
| `/api/content/entries` (+`:id`) | CRUD entri — draft/publish/archive lifecycle, **versioning + restore**, tag management |
| `/api/categories` (+`:id`) | CRUD kategori (hierarki) |
| `/api/tags` (+`:id`) | CRUD tag |
| `/api/media` | upload multipart, list, delete (MinIO + DB) |

### Delivery API (publik, read-only) — prefix `/api/delivery/v1`

| Endpoint | Fungsi |
|---|---|
| `GET /api/delivery/v1/content` | konten **published** + filter (contentType, locale, tag, category, slug, pagination) |
| `GET /api/delivery/v1/content/:slug` | entri published by slug |
| `GET /api/delivery/v1/categories` | daftar kategori |
| `GET /api/delivery/v1/tags` | daftar tag |
| `GET /api/delivery/v1/media/:storageKey` | stream file media |

### Health & Metrics

| Endpoint | Fungsi |
|---|---|
| `GET /api/health` | terminus — status database |
| `GET /metrics` | Prometheus metrics |

## Autentikasi (delegasi ke UMS)

- CMS **tidak punya endpoint login** — hanya memverifikasi JWT RS256 yang diterbitkan **ums-service**.
- Public key UMS via env `UMS_JWT_PUBLIC_KEY` (PEM inline, `\n`-escaped) **atau** `UMS_JWT_PUBLIC_KEY_PATH` (path file) — **tepat satu** wajib diisi (dikelola `src/common/utils/ums-jwt-key.util.ts`).
- Klaim yang dibaca guard: `sub`, `email`, `roles[]`, `perms[]` (lihat `src/common/interfaces/auth-user.interface.ts`). Endpoint publik ditandai `@Public()`; role check via `@Roles()` + `RolesGuard`.
- Alur FE: login ke UMS → dapat access token → `Authorization: Bearer <token>` ke CMS.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | development / production / test |
| `PORT` | No | `3000` | Server port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `UMS_JWT_PUBLIC_KEY` | Yes* | — | UMS JWT Public Key (PEM, literal `\n` supported) |
| `UMS_JWT_PUBLIC_KEY_PATH` | Yes* | — | Path file PEM public key UMS |
| `CORS_ORIGINS` | No | — | Origin dipisah koma; kosong = allow all (dev) |
| `FILE_SERVICE_URL` | Yes | — | URL minio-file-service (mis. `http://100.92.245.124:3110/api`) |
| `FILE_SERVICE_EMAIL` | Yes | — | Service-account email file service |
| `FILE_SERVICE_PASSWORD` | Yes | — | Service-account password |
| `FILE_SERVICE_TIMEOUT_MS` | No | `10000` | Timeout HTTP ke file service (ms) |

*\* Tepat satu dari `UMS_JWT_PUBLIC_KEY` / `UMS_JWT_PUBLIC_KEY_PATH` wajib diisi.*

## Menjalankan

```bash
bun install
bunx prisma migrate dev        # dev — terapkan migrasi
bunx prisma migrate deploy     # prod
bun run start:dev              # dev + watch
bun run build && bun run start:prod

# Gates
bun run lint
bun run test                   # unit (jest)
bun run test:e2e               # e2e (jest-e2e config)
```

## Deployment

- Dockerfile tersedia (Dockerfile.dev untuk dev); CI GitHub Actions (`build/quality/test`) wajib hijau per PR.
- Deploy produksi **via Portainer stack** (house rule) di host `soerjo-sever`, network `internal_net`, DB di `postgres_db`.
- Env/secret stack disimpan di Portainer + di-backup ke repo `container-envs` (standing rule).

## Terkait

- **ums-service** — penerbit JWT (login, roles, permissions, orgs); dokumentasinya ada di README repo tersebut
- **minio-file-service** — penyimpanan file fisik (Portainer stack 42, port 3110)
- **my-nextjs-template** — basis FE yang mengonsumsi CMS

## Konvensi Kontribusi

- Ship via **PR ke main** — CI wajib hijau sebelum merge; tidak pernah push langsung ke main.
- Selalu mulai dari clone fresh GitHub `main` terbaru; jangan pakai clone lokal yang basi.
- Perubahan schema Prisma → migration file ter-commit bersama PR-nya.
- Secret tidak pernah masuk repo: env di-inject runtime (Portainer/.env lokal, gitignored).