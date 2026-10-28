# PRD — Standalone File Upload Service (v1)

| Field        | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| Product      | Standalone file-upload service (this repository)                          |
| Version      | v1 — initial release                                                      |
| Status       | Target contract for implementation (docs-first)                           |
| Date         | 2026-10-13                                                                |
| Related docs | `docs/API_CONTRACT.md` (endpoints), `docs/DB_DESIGN.md` (database design) |

## 1. Overview

This service is a **standalone file-upload application** built on the existing NestJS template in this repository. Authenticated users upload files; the binaries are stored as objects in **MinIO** (S3-compatible object storage, bucket **`app-uploads`**) while **PostgreSQL** (new table **`file_uploads`**) holds the authoritative metadata for every upload. Downloads go through **time-limited presigned URLs** (15 minutes) so the API never proxies file bytes. Deletion is **soft**: metadata rows and stored objects are never physically removed in v1.

The service is API-only (JSON REST under the global `/api` prefix, Swagger at `/docs`). Authentication and user/organization management reuse the template's existing JWT infrastructure, with the auth surface simplified for this product (§7).

## 2. Goals (v1)

1. **Upload with metadata** — one file per request, stored in MinIO with a complete metadata row in PostgreSQL.
2. **List, search, sort** — paginated listing with case-insensitive name search and sortable fields.
3. **Detail view** — fetch a single file's metadata by id.
4. **Time-limited presigned downloads** — 15-minute GET URLs generated on demand; clients download directly from MinIO.
5. **Soft delete** — mark files `DELETED` while preserving rows and objects (no data loss in v1).

## 3. Functional requirements

### FR1 — Upload

- `POST /api/files/upload` with `multipart/form-data`, single field **`file`** (one file per request).
- Enforced server-side **before** the object is stored:
  - Max size **25 MB** → `413 FILE_TOO_LARGE`
  - MIME whitelist (§4) → `415 UNSUPPORTED_MEDIA_TYPE`
- The object is stored in bucket **`app-uploads`** under object key `{userId}/{uuid}-{sanitizedOriginalName}` (uuid guarantees uniqueness; sanitization rules in `docs/DB_DESIGN.md`).
- Response: the created `FileUpload` object (field-by-field contract in `docs/API_CONTRACT.md`).

### FR2 — Metadata persistence

Every upload writes exactly one row to `file_uploads` recording `id`, `bucket`, `object_key`, `original_name`, `mime_type`, `size_bytes`, `checksum` (sha256 hex, computed server-side), `status` (`ACTIVE`), `uploaded_by`, `created_at`, `updated_at`. Column-level specification: `docs/DB_DESIGN.md`.

### FR3 — Presigned download URLs

- `GET /api/files/:id/url` returns `{ url, expiresAt }` — a **GET-method presigned URL** with a **15-minute expiry**; `expiresAt` is ISO 8601.
- Access: **owner + ADMIN**.
- A presigned URL is a short-lived bearer credential for the object itself; it is only ever generated for an authenticated owner/ADMIN request.

### FR4 — List, search, sort

- `GET /api/files` query parameters:
  - `page` — default **1**; `limit` — default **20**
  - `search` — case-insensitive contains on `originalName`
  - `sort` — `field:asc|desc`; allowed fields **`createdAt` | `originalName` | `size`**; default **`createdAt:desc`**
- Response: `{ items: FileUpload[], total, page, limit }`.
- **`DELETED` files are excluded from the default list.**

### FR5 — Soft delete

- `DELETE /api/files/:id` sets `status` → `DELETED` and returns `200` with the updated `FileUpload`.
- A missing id **or an already-`DELETED`** id returns `404 FILE_NOT_FOUND`.
- Access: **owner + ADMIN**.
- The DB row is never removed in v1, and the **MinIO object is NOT deleted** on soft delete.

## 4. MIME whitelist (v1)

Enforced server-side on upload; anything outside this list → `415 UNSUPPORTED_MEDIA_TYPE`.

| Category | Extensions                                  | MIME types                                                                                                                                                                                                                                                                                                     |
| -------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Images   | `png`, `jpg`, `jpeg`, `gif`, `webp`         | `image/png`, `image/jpeg`, `image/gif`, `image/webp`                                                                                                                                                                                                                                                           |
| PDF      | `pdf`                                       | `application/pdf`                                                                                                                                                                                                                                                                                              |
| Office   | `doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx` | `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| Text     | `txt`, `csv`, `md`                          | `text/plain`, `text/csv`, `text/markdown`                                                                                                                                                                                                                                                                      |

## 5. Non-goals (v1)

Deliberately out of scope for v1 — none of these contradict the goals in §2:

1. **Public / anonymous sharing links** — every `/api/files` route requires JWT; presigned URLs are generated only for authenticated owner/ADMIN requests and expire after 15 minutes, so they are not permanent share links.
2. **Chunked / resumable uploads** — single-request multipart only.
3. **Virus / malware scanning** — no content inspection beyond MIME whitelisting.
4. **Checksum-based deduplication** — the sha256 checksum is stored for integrity verification only; identical files are stored independently.
5. **Hard delete or purge job** — no endpoint and no scheduled job removes rows or objects in v1.
6. **Per-organization storage quotas.**
7. **Thumbnails or any image processing.**
8. **Folders or tagging** — the file list is flat.
9. **Download analytics** — no download counting or reporting beyond standard request logs.

## 6. Constraints

- **Auth**: all `/api/files` routes require a valid JWT (existing global guard).
- **Access control**: owner + ADMIN, using the existing `RoleName` enum (`SYSTEM` / `ADMIN` / `USER`).
- **Size limit**: 25 MB, enforced server-side → `413 FILE_TOO_LARGE`; client-side checks are never trusted.
- **MIME whitelist**: enforced server-side → `415 UNSUPPORTED_MEDIA_TYPE`.
- **Integrity**: sha256 checksum computed server-side at upload time (integrity only — not dedup).
- **Rate limiting**: the template's global throttle applies (10 req/60s) → `429 RATE_LIMITED`.

## 7. Scope changes vs the NestJS template

The product is carved out of the current template by REMOVING functionality:

1. **Email module removed** — nodemailer, mail templates, SMTP configuration, and the `forgot-password` / `reset-password` email flows. The `forgotPasswordRequest` column on `users` becomes obsolete (drop candidate — see `docs/DB_DESIGN.md`).
2. **Metrics module removed** — prom-client registry and default process metrics, metric recording in the request-logging middleware, the raw `/metrics` endpoint, and the docker-compose `prometheus` + `grafana` services with their provisioning files.
3. **Auth simplified** — remaining surface: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/verify-token`, `POST /api/auth/refresh-token`, `POST /api/auth/change-password`. Removed: Google OAuth (`GET /api/auth/google`, `GET /api/auth/google/callback`), `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/auth/set-password`.
4. **Response envelope standardized (target)** — success `{ success: true, data, message? }`, error `{ success: false, error: { code, message, details? } }`, replacing the template's current `{ statusCode, message, data, timestamp, path }` wrapper. The swap itself is implementation work; the contract lives in `docs/API_CONTRACT.md`.

## 8. Dependencies

- **PostgreSQL** — existing template database via Prisma v6 (`users`, `organizations` already exist; `file_uploads` is new).
- **MinIO** — S3-compatible object storage with a pre-provisioned bucket **`app-uploads`**; endpoint and credentials supplied via environment configuration at implementation time.
- **JWT auth** — the template's existing endpoints (`register`, `login`, `verify-token`, `refresh-token`, `change-password`).
- **NestJS v11 / Express stack** — global `/api` prefix, global validation pipe, Swagger at `/docs`.
