# API Contract — File Upload Service (v1)

| Field        | Value                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| Base path    | `/api` (global prefix)                                                   |
| Version      | v1 — target contract for implementation                                  |
| Date         | 2026-10-13                                                               |
| Related docs | `docs/PRD.md` (requirements), `docs/DB_DESIGN.md` (schema/field mapping) |

## 1. Conventions

- **Base URL**: `http://<host>:<port>/api` — the app uses the global `/api` prefix (dev default port `3000`; examples below assume it). Swagger UI is served at `/docs`.
- **Authentication**: `Authorization: Bearer <accessToken>` (JWT). Endpoints marked **public** require no token; everything else requires a valid access token. Access tokens expire after **15 minutes**, refresh tokens after **7 days** (defaults, environment-configurable).
- **Content types**: `application/json` for all requests and responses, except `POST /files/upload` which uses `multipart/form-data`.
- **Identifiers** are uuid strings; **timestamps** are ISO 8601 UTC.
- **Rate limiting**: 10 requests / 60 s per IP (global throttle) → `429 RATE_LIMITED`.
- **Uploads**: max **25 MB** per file; **MIME whitelist** enforced server-side (see §4.1 and `docs/PRD.md` §4).
- The auth surface is the **simplified** one (login, register, verify-token, refresh-token, change-password) — removed endpoints are listed in §3.7.

## 2. Response envelope (target)

All responses — success and error — use a uniform envelope:

```json
// success
{
  "success": true,
  "data": { },
  "message": "optional, human-readable"
}

// error
{
  "success": false,
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "human-readable description",
    "details": [ ]
  }
}
```

- `data` — the endpoint's payload (`null` when there is none). `message` — optional on success.
- `error.code` — stable, machine-readable string (catalog in §6). `error.details` — optional, e.g. validation error messages.

> **Note (drift vs current code)**: the template currently wraps responses as `{ statusCode, message, data, timestamp, path }`. This contract defines the **target** envelope `{ success, data, message? }` / `{ success, error }`; the interceptor/filter swap happens at implementation time.

## 3. Auth endpoints

All auth routes live under `/api/auth`. Request shapes below are cross-checked against the template's DTOs (`src/modules/auth/dto/`).

### 3.1 `POST /auth/login` — public

Request body:

| Field      | Type   | Rules                 |
| ---------- | ------ | --------------------- |
| `email`    | string | valid email, required |
| `password` | string | non-empty, required   |

Response `200` — `data`:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "9b2f1c4a-3d5e-4f6a-8b7c-1d2e3f4a5b6c",
    "email": "user@example.com",
    "firstName": "Ada",
    "lastName": "Lovelace",
    "role": "USER",
    "organizationId": "0f9e8d7c-6a5b-4c3d-2e1f-0a9b8c7d6e5a"
  }
}
```

> **Note (drift vs current code)**: `auth.service.ts` `login()` currently returns only `{ accessToken, refreshToken }`. The target contract adds the `user` field; resolved at implementation time.

Errors: `401 UNAUTHORIZED` — wrong email or password.

**Example**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password123"}'
```

Error example (`401`):

```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Invalid email or password" }
}
```

### 3.2 `POST /auth/register` — public

Request body:

| Field       | Type   | Rules                  |
| ----------- | ------ | ---------------------- |
| `email`     | string | valid email, required  |
| `password`  | string | min length 8, required |
| `firstName` | string | optional               |
| `lastName`  | string | optional               |

Response `201` — `data`: the created **User** object (§3.6). Registration auto-provisions a personal organization and assigns the `ADMIN` role of it, so `role` is `"ADMIN"` and `organizationId` points at the new org.

**Example**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password123","firstName":"Ada","lastName":"Lovelace"}'
```

Response (`201`):

```json
{
  "success": true,
  "data": {
    "id": "9b2f1c4a-3d5e-4f6a-8b7c-1d2e3f4a5b6c",
    "email": "user@example.com",
    "firstName": "Ada",
    "lastName": "Lovelace",
    "role": "ADMIN",
    "organizationId": "0f9e8d7c-6a5b-4c3d-2e1f-0a9b8c7d6e5a"
  }
}
```

Errors: `400 VALIDATION_ERROR` (invalid email / short password), `400 VALIDATION_ERROR` with "email already in use" message (duplicate email).

### 3.3 `GET /auth/verify-token` — JWT

Verifies the caller's access token (the global JWT guard already did the work; this endpoint returns the user).

Response `200` — `data`:

```json
{
  "valid": true,
  "user": {
    "id": "9b2f1c4a-3d5e-4f6a-8b7c-1d2e3f4a5b6c",
    "email": "user@example.com",
    "firstName": "Ada",
    "lastName": "Lovelace",
    "role": "USER",
    "organizationId": "0f9e8d7c-6a5b-4c3d-2e1f-0a9b8c7d6e5a"
  }
}
```

**Example**

```bash
curl http://localhost:3000/api/auth/verify-token \
  -H 'Authorization: Bearer <accessToken>'
```

### 3.4 `POST /auth/refresh-token` — public

Request body:

| Field          | Type   | Rules               |
| -------------- | ------ | ------------------- |
| `refreshToken` | string | non-empty, required |

Response `200` — `data`: `{ accessToken, refreshToken, user }` — the same shape as login (§3.1), including the same drift note (current code returns only the two tokens).

**Example**

```bash
curl -X POST http://localhost:3000/api/auth/refresh-token \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'
```

Errors: `401 UNAUTHORIZED` — invalid/expired refresh token or user no longer exists.

### 3.5 `POST /auth/change-password` — JWT

Request body:

| Field             | Type   | Rules                  |
| ----------------- | ------ | ---------------------- |
| `currentPassword` | string | non-empty, required    |
| `newPassword`     | string | min length 8, required |

Response `200` — `data: null`, `message: "Password changed successfully"`.

**Example**

```bash
curl -X POST http://localhost:3000/api/auth/change-password \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{"currentPassword":"password123","newPassword":"newSecurePassword123"}'
```

Errors: `401 UNAUTHORIZED` (incorrect current password), `400 VALIDATION_ERROR`.

### 3.6 User object

Returned by login, register, verify-token, refresh-token (`user` field / `data`):

| Field            | Type   | Notes                                      |
| ---------------- | ------ | ------------------------------------------ |
| `id`             | uuid   |                                            |
| `email`          | string |                                            |
| `firstName`      | string | nullable                                   |
| `lastName`       | string | nullable                                   |
| `role`           | string | `SYSTEM` \| `ADMIN` \| `USER` (`RoleName`) |
| `organizationId` | uuid   | the user's single organization (PRD/DB)    |

### 3.7 Removed / out-of-scope endpoints

Removed with the product's scope changes (see `docs/PRD.md` §7) and **not part of this contract**:

- `GET /auth/google`, `GET /auth/google/callback` (Google OAuth)
- `POST /auth/forgot-password`, `POST /auth/reset-password` (email flows)
- `POST /auth/set-password`

## 4. Files endpoints

All files routes live under `/api/files` and **require a valid JWT**. Access control is **owner + ADMIN**: a file is visible/mutable to the user who uploaded it (`uploadedBy`) and to users with the `ADMIN` role. **Soft-deleted files are invisible** — any endpoint addressing a missing or `DELETED` file returns `404 FILE_NOT_FOUND`.

### 4.1 `POST /files/upload` — JWT

`multipart/form-data` with a single field **`file`** (one file per request). Enforced before storage:

- max size **25 MB** → `413 FILE_TOO_LARGE`
- MIME whitelist → `415 UNSUPPORTED_MEDIA_TYPE`: images (`png`, `jpg`, `jpeg`, `gif`, `webp`), pdf (`pdf`), office (`doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx`), text (`txt`, `csv`, `md`) — full MIME-type table in `docs/PRD.md` §4

Response `201` — `data`: the created **FileUpload** object (§5).

**Example**

```bash
curl -X POST http://localhost:3000/api/files/upload \
  -H 'Authorization: Bearer <accessToken>' \
  -F 'file=@./invoice.pdf'
```

Error example (`415`):

```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_MEDIA_TYPE",
    "message": "MIME type application/x-msdownload is not allowed"
  }
}
```

(Oversized files return `413 FILE_TOO_LARGE` the same way.)

### 4.2 `GET /files` — JWT

Query parameters:

| Param    | Type   | Rules                                                                                                                            |
| -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `page`   | int    | ≥ 1, default **1**                                                                                                               |
| `limit`  | int    | ≥ 1, default **20**, clamped to max **100**                                                                                      |
| `search` | string | case-insensitive contains on `originalName`                                                                                      |
| `sort`   | string | `field:asc` \| `field:desc`; fields `createdAt` \| `originalName` \| `size`; default **`createdAt:desc`**; anything else → `400` |

Response `200` — `data`:

```json
{
  "items": [{ "...": "FileUpload objects (§5)" }],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

- `total` — total matching (non-`DELETED`) rows; `page`/`limit` echo the **effective** values (post-clamp).
- **Scope**: `USER` role sees **own uploads only**; `ADMIN` role sees **all uploads**.
- `DELETED` files are excluded.

**Example**

```bash
curl 'http://localhost:3000/api/files?page=1&limit=20&search=invoice&sort=createdAt:desc' \
  -H 'Authorization: Bearer <accessToken>'
```

Error example (`400`, bad sort):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid sort parameter",
    "details": ["sort must be <createdAt|originalName|size>:<asc|desc>"]
  }
}
```

### 4.3 `GET /files/:id` — JWT, owner + ADMIN

Response `200` — `data`: the **FileUpload** object (§5).

**Example**

```bash
curl http://localhost:3000/api/files/3f8a2c1e-9d4b-4a6f-8e2c-1b2d3e4f5a6b \
  -H 'Authorization: Bearer <accessToken>'
```

Error example (`404` — unknown id **or** soft-deleted file):

```json
{
  "success": false,
  "error": { "code": "FILE_NOT_FOUND", "message": "File not found" }
}
```

### 4.4 `GET /files/:id/url` — JWT, owner + ADMIN

Returns a **GET-method presigned URL** for downloading the object directly from MinIO, valid for **15 minutes**.

Response `200` — `data`:

```json
{
  "url": "http://localhost:9000/app-uploads/9b2f.../7c1b9d0e-...-Invoice-42-EU.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&...",
  "expiresAt": "2026-10-13T12:45:00.000Z"
}
```

- `expiresAt` — ISO 8601, exactly **+15 minutes** from generation.
- The URL is a short-lived credential: it works **without** the JWT header until it expires (clients should download or re-presign before `expiresAt`).
- The URL host is signed into the request (S3 SigV4 covers the `Host` header), so it is produced from the **public** MinIO endpoint (`MINIO_PUBLIC_ENDPOINT`/`MINIO_PUBLIC_PORT`, falling back to `MINIO_ENDPOINT`/`MINIO_PORT` when unset) — the address a browser can actually reach. It cannot be rewritten after the fact; only the signed host is returned.

**Example**

```bash
curl http://localhost:3000/api/files/3f8a2c1e-9d4b-4a6f-8e2c-1b2d3e4f5a6b/url \
  -H 'Authorization: Bearer <accessToken>'
```

### 4.5 `DELETE /files/:id` — JWT, owner + ADMIN

**Soft delete** — sets `status` → `DELETED`; the DB row and the MinIO object are retained (v1 has no hard delete, see `docs/PRD.md` §5/§7).

Response `200` — `data`: the updated **FileUpload** object with `"status": "DELETED"`.

**Example**

```bash
curl -X DELETE http://localhost:3000/api/files/3f8a2c1e-9d4b-4a6f-8e2c-1b2d3e4f5a6b \
  -H 'Authorization: Bearer <accessToken>'
```

Errors: `404 FILE_NOT_FOUND` — unknown id **or** already `DELETED`.

## 5. FileUpload object

| Field          | Type   | Notes                                                           |
| -------------- | ------ | --------------------------------------------------------------- |
| `id`           | uuid   |                                                                 |
| `bucket`       | string | MinIO bucket holding the object; normally `app-uploads`, but legacy `ORPHAN` rows may point at another bucket (see note below) |
| `objectKey`    | string | MinIO object key (`{userId}/{uuid}-{sanitizedOriginalName}`)    |
| `originalName` | string | file name as uploaded                                           |
| `mimeType`     | string | whitelisted MIME type                                           |
| `size`         | int    | bytes — maps to DB column `size_bytes` (`docs/DB_DESIGN.md` §4) |
| `checksum`     | string | sha256 hex (64 chars), computed server-side                     |
| `status`       | string | `ACTIVE` \| `DELETED`                                           |
| `uploadedBy`   | uuid   | uploader's user id — maps to DB column `uploaded_by`            |
| `createdAt`    | string | ISO 8601                                                        |
| `updatedAt`    | string | ISO 8601                                                        |

Sample:

```json
{
  "id": "3f8a2c1e-9d4b-4a6f-8e2c-1b2d3e4f5a6b",
  "bucket": "app-uploads",
  "objectKey": "9b2f1c4a-3d5e-4f6a-8b7c-1d2e3f4a5b6c/7c1b9d0e-2f4a-4c6e-8a0b-9c8d7e6f5a4b-Invoice-42-EU.pdf",
  "originalName": "Invoice 42 EU.pdf",
  "mimeType": "application/pdf",
  "size": 1048576,
  "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "status": "ACTIVE",
  "uploadedBy": "9b2f1c4a-3d5e-4f6a-8b7c-1d2e3f4a5b6c",
  "createdAt": "2026-10-13T09:15:00.000Z",
  "updatedAt": "2026-10-13T09:15:00.000Z"
}
```

> **Per-object bucket.** Presigned URLs are signed against each row's own
> `bucket` column, so a row is never assumed to live in `app-uploads`. Some
> legacy `ORPHAN` rows historically embedded the real bucket name as a prefix
> of `objectKey` (e.g. `bucket='app-uploads'` + `objectKey='test/x.png'` for an
> object that actually lives in bucket `test` at key `x.png`). Migration
> `20261014093000_normalize_orphan_buckets` normalizes those known prefixes so
> `bucket` and `objectKey` reflect where the object truly lives.

## 6. Error catalog

| HTTP | `error.code`             | Trigger                                                                   |
| ---- | ------------------------ | ------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`       | request body/query fails validation (unknown fields, bad email, bad sort) |
| 401  | `UNAUTHORIZED`           | missing/invalid bearer token; bad login credentials; bad refresh token    |
| 401  | `TOKEN_EXPIRED`          | expired access token                                                      |
| 404  | `FILE_NOT_FOUND`         | file id unknown or soft-`DELETED`                                         |
| 413  | `FILE_TOO_LARGE`         | upload exceeds 25 MB                                                      |
| 415  | `UNSUPPORTED_MEDIA_TYPE` | MIME type not in the whitelist                                            |
| 429  | `RATE_LIMITED`           | more than 10 requests / 60 s per IP                                       |
| 500  | `INTERNAL_ERROR`         | unhandled server error                                                    |
| 500  | `MINIO_UNAVAILABLE`      | MinIO operation failed (put object / presign URL)                         |

Sample bodies:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": ["email must be a valid email"]
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid bearer token"
  }
}
```

```json
{
  "success": false,
  "error": { "code": "TOKEN_EXPIRED", "message": "Access token expired" }
}
```

```json
{
  "success": false,
  "error": { "code": "FILE_NOT_FOUND", "message": "File not found" }
}
```

```json
{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File exceeds the 25 MB limit"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_MEDIA_TYPE",
    "message": "MIME type image/heic is not allowed"
  }
}
```

```json
{
  "success": false,
  "error": { "code": "RATE_LIMITED", "message": "Too many requests" }
}
```

```json
{
  "success": false,
  "error": { "code": "INTERNAL_ERROR", "message": "Internal server error" }
}
```

```json
{
  "success": false,
  "error": {
    "code": "MINIO_UNAVAILABLE",
    "message": "Object storage is temporarily unavailable"
  }
}
```
