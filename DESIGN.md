# UMS — User Management Service (Design & API Contract v1)

> Self-hosted user management & authentication untuk ekosistem bank-sampah
> (mobile, warehouse, POS, accounting) dan aplikasi lain milik Mas Soerjo.
> Menggantikan Keycloak (di-take-down 2026-10-16; arsip dump ada di repo `container-envs`).

## 1. Prinsip

- **AuthN di UMS, AuthZ granular di BE tiap app** — UMS pegang identitas + role kasar + org membership; keputusan fine-grained (per cabang, per fitur) tetap di DB aplikasi masing-masing.
- **JWT stateless untuk access token** — semua BE memverifikasi tanda tangan secara lokal (public key / JWKS), tanpa call ke UMS per request.
- **Refresh token rotation + reuse detection** — sesi terlacak di DB; pencurian token terdeteksi dan seluruh sesi keluarga di-revoke.
- **Standar keamanan**: argon2id untuk password, rate-limit login, helmet, no password in logs.

## 2. Stack

| Komponen | Pilihan |
|---|---|
| Framework | NestJS (dari template `my-nestjs-template`) |
| DB | PostgreSQL — database `ums_db` di `postgres_db` (shared, stack Portainer 14) |
| ORM | Prisma |
| Password | argon2 (ganti bcryptjs dari template) |
| Token | @nestjs/jwt (RS256 — asymmetric, BE lain verify via public key) |
| Rate limit | @nestjs/throttler |
| Dokumentasi | @nestjs/swagger |
| Deploy | Portainer stack (endpoint 3), network `internal_net` |

## 3. Model data (Prisma)

```
User        id (uuid) · email unique · passwordHash · name · emailVerifiedAt
            status (ACTIVE/BLOCKED) · createdAt/updatedAt
Session     id · userId → User · refreshHash (sha256, unique)
            family (uuid, untuk rotation chain) · userAgent · ip
            expiresAt · revokedAt? · replacedByHash? · createdAt
Role        id · name unique (mis. ums:admin, bs:staff) · description
UserRole    userId+roleId (PK compound) · assignedAt
Organization id · name unique (cabang: bintaro, pd-aren, tangsel, pesanggrahan...)
OrgMember   orgId+userId (PK compound) · role di org (text: admin/member)
Token       (email verification / password reset)
            id · userId · type (EMAIL_VERIFY/PASSWORD_RESET) · tokenHash
            expiresAt · usedAt?
```

## 4. Kontrak API (REST, prefix /api)

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| POST | /api/auth/register | public | daftar (email, password, name) → user ACTIVE, kirim token verifikasi (tanpa SMTP v1: langsung terverifikasi) |
| POST | /api/auth/login | public (throttle ketat) | email+password → `{accessToken, refreshToken, user}`; refresh token di-cookie HttpOnly untuk web |
| POST | /api/auth/refresh | cookie atau body | rotate refresh token; **reuse terdeteksi → revoke family** |
| POST | /api/auth/logout | bearer | revoke session ini |
| POST | /api/auth/logout-all | bearer | revoke semua sesi user |
| GET | /api/auth/me | bearer | profil dari token |
| GET | /api/users | bearer + role | list user (pagination) |
| GET | /api/users/:id | bearer + role | detail |
| PATCH | /api/users/:id | bearer + role | update profil/status |
| POST | /api/users/:id/roles | bearer + role | set role |
| GET/POST/DELETE | /api/orgs, /api/orgs/:id/members | bearer + role | kelola organization & membership |
| GET | /api/.well-known/jwks.json | public | public key RSA untuk BE lain |
| GET | /api/health | public | terminus |

Access token: 15 menit, klaim `{sub, email, roles[], orgs[], iss, azp}`.
Refresh token: 30 hari, opaque 32-byte random, disimpan sebagai SHA-256 hash.

## 5. Keamanan

- argon2id (memory 19MiB default OWASP)
- Login throttler: 5 req/menit per IP+email
- Refresh reuse detection: token lama dipakai lagi → revoke semua session dalam `family` yang sama
- Logout-all mengganti `tokenVersion`/revocation sehingga access token lama > 15 menit pun mati via `session check` pada refresh saja
- Kunci JWT: RSA private di env UMS (rotate-able), public via JWKS
- Seed: 1 admin awal (password dari env, bukan hardcode) — idempotent `prisma/seed.ts`

## 6. Out of scope v1 (nanti)

SMTP kirim email, 2FA/TOTP, OAuth social login (template punya passport-google, disable dulu), Redis cache, audit log UI.
