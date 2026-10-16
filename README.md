<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>

## Description

Standalone CMS backend built with NestJS v11, Prisma v6, PostgreSQL, and MinIO storage. JWT verification is performed via UMS (User Management Service) public key (RS256).

## Project setup

```bash
$ bun install
```

## Compile and run the project

```bash
# development
$ bun run start:dev

# production mode
$ bun run start:prod
```

## Environment variables

Create a `.env` file before running the app. Key variables:

| Variable                 | Required | Default       | Description                                                                       |
| ------------------------ | -------- | ------------- | --------------------------------------------------------------------------------- |
| `NODE_ENV`               | No       | `development` | development \| production \| test                                                 |
| `PORT`                   | No       | `3000`        | Server port                                                                       |
| `DATABASE_URL`           | Yes      | —             | PostgreSQL connection string                                                      |
| `UMS_JWT_PUBLIC_KEY`     | Yes*     | —             | UMS JWT Public Key (PEM format, literal `\n` supported)                           |
| `UMS_JWT_PUBLIC_KEY_PATH`| Yes*     | —             | Path to UMS JWT Public Key PEM file                                               |
| `CORS_ORIGINS`           | No       | —             | Comma-separated allowed origins; unset/empty enables CORS for all origins (dev)   |
| `FILE_SERVICE_URL`       | Yes      | —             | File service API URL (e.g. http://localhost:3100/api)             |
| `FILE_SERVICE_EMAIL`     | Yes      | —             | File service service-account email                                |
| `FILE_SERVICE_PASSWORD`  | Yes      | —             | File service service-account password                             |
| `FILE_SERVICE_TIMEOUT_MS`| No       | `10000`       | File service request timeout in ms                                |

*\* Exactly one of `UMS_JWT_PUBLIC_KEY` or `UMS_JWT_PUBLIC_KEY_PATH` must be provided.*

## CMS & Delivery API Routes

### Authenticated CMS Management (`/api`)
- `/api/content-types` — Content Type definitions CRUD
- `/api/content/entries` — Content Entry CRUD, draft/publish/archive lifecycle, versioning, restore, and tag management
- `/api/categories` — Category hierarchy CRUD
- `/api/tags` — Tag management CRUD
- `/api/media` — Media asset upload (multipart), list, delete (MinIO + DB)

### Public Delivery (`/api/delivery/v1`)
- `GET /api/delivery/v1/content` — Read-only published content entries with filtering (contentType, locale, tag, category, slug, pagination)
- `GET /api/delivery/v1/content/:slug` — Published entry by slug
- `GET /api/delivery/v1/categories` — List all categories
- `GET /api/delivery/v1/tags` — List all tags
- `GET /api/delivery/v1/media/:storageKey` — Stream media asset

### Health & Metrics
- `GET /api/health` — DB health check
- `GET /metrics` — Prometheus metrics
