# AGENTS.md

## Commands

- `npm run build` — nest build (output to `dist/`, cleared each build)
- `npm run start:dev` — dev server with watch (port 3000, overridable via `PORT` env)
- `npm run lint` — eslint with auto-fix (flat config at `eslint.config.mjs`)
- `npm run test` — unit tests (jest, `src/**/*.spec.ts`)
- `npm run test:e2e` — e2e tests (jest, `test/**/*.e2e-spec.ts`, config at `test/jest-e2e.json`)
- `npm run format` — prettier on `src/` and `test/`
- `npm run test:cov` — coverage output to `coverage/`
- `npx prisma generate` — regenerate Prisma client after schema changes
- `npx prisma migrate dev` — create and apply a migration (dev)
- `npx prisma migrate deploy` — apply pending migrations (prod)

Run a single test file: `npx jest src/path/to/file.spec.ts`
Run a single e2e test: `npx jest --config ./test/jest-e2e.json test/app.e2e-spec.ts`

No typecheck script is defined; use `npx tsc --noEmit` to typecheck.

## Key facts

- NestJS v11, Express adapter, single app (no monorepo)
- TypeScript with `module: "nodenext"`, target `ES2023`, `noImplicitAny: false`, `strictNullChecks: true`
- ESLint uses `projectService: true` (type-aware linting) — typecheck errors can surface as lint errors
- ESLint rule overrides: `@typescript-eslint/no-explicit-any` is off, `no-floating-promises` and `no-unsafe-argument` are warn
- Prettier: single quotes, trailing commas
- All imports use `.js` extensions (required by `nodenext` module resolution)
- Jest v30 (both unit and e2e)

## Architecture

```
src/
  main.ts                  # Bootstrap, global pipes/filters/interceptors, Swagger setup
  app.module.ts            # Root module, global guards (Throttler, JWT, Roles)
  config/
    env.validation.ts      # class-validator startup validation for env vars
    logger.config.ts       # Winston logger config (console transport, NestJS-like format)
  prisma/
    prisma.module.ts       # @Global() PrismaModule
    prisma.service.ts      # PrismaService (OnModuleInit/OnModuleDestroy lifecycle)
  common/
    constants/index.ts     # ROLES = { ADMIN, USER } (defined but unused — roles are hardcoded strings)
    decorators/
      current-user.decorator.ts   # @CurrentUser() / @CurrentUser('id')
      public.decorator.ts         # @Public() — bypasses JwtAuthGuard
      roles.decorator.ts          # @Roles('ADMIN') — restricts by role
    dto/
      base-response.dto.ts        # Shared response DTO (defined but unused)
      pagination.dto.ts           # page/limit query DTO (defined but unused)
    filters/
      all-exceptions.filter.ts    # Global exception filter
    guards/
      jwt-auth.guard.ts           # Global JWT auth guard (respects @Public)
      roles.guard.ts              # Global roles guard (queries userOrganization table for role names)
    interceptors/
      response-transform.interceptor.ts  # Wraps all responses in { statusCode, message, data, timestamp, path }
    interfaces/
      auth-user.interface.ts      # { id: string; email: string }
      jwt-payload.interface.ts    # { sub: string; email: string }
  modules/
    auth/                         # Register, login (local strategy), JWT strategy, refresh
      strategies/
        local.strategy.ts         # Validates email/password via AuthService -> UsersRepository
        jwt.strategy.ts           # Verifies Bearer token, calls AuthService.validateUserById
      local-auth.guard.ts         # Non-global, used only on POST /auth/login
    users/                        # CRUD (admin-guarded) + GET /me profile
    organizations/                # CRUD (admin-guarded) + GET /slug/:slug (public)
    roles/                        # CRUD (admin-guarded)
    user-organizations/           # CRUD (admin-guarded) — junction table: user + org + role
    health/                       # Terminus health check with Prisma indicator
```

## Database schema (PostgreSQL via Prisma v6)

- **User** — id (UUID), email (unique), password, firstName?, lastName?, isActive (default true), timestamps
- **Role** — id (UUID), name (unique), timestamps
- **Organization** — id (UUID), name, slug (unique), description?, website?, logoUrl?, timestamps
- **UserOrganization** — id (UUID), userId (FK), organizationId (FK), roleId (FK), timestamps; composite unique on `[userId, organizationId]`; cascade deletes on all FKs
- No enums in schema — roles are string-based
- No soft deletes implemented (isActive field exists on User but is never checked)

## Routes

All routes under global prefix `/api`. Total: 23 routes (4 public, 19 JWT-protected, 16 admin-gated) + 1 raw Express handler outside the prefix (`GET /metrics`, public — see Metrics below).

### Auth (`/api/auth`)

| Method | Path        | Auth                    | Description                                                 |
| ------ | ----------- | ----------------------- | ----------------------------------------------------------- |
| POST   | `/register` | Public                  | Register new user                                           |
| POST   | `/login`    | Public + LocalAuthGuard | Login, returns `{ accessToken, refreshToken }`              |
| POST   | `/refresh`  | JWT                     | Refresh tokens, returns new `{ accessToken, refreshToken }` |

### Users (`/api/users`)

| Method | Path   | Auth  | Description            |
| ------ | ------ | ----- | ---------------------- |
| GET    | `/me`  | JWT   | Current user's profile |
| GET    | `/`    | ADMIN | List all users         |
| GET    | `/:id` | ADMIN | Get user by ID         |
| PATCH  | `/:id` | ADMIN | Update user by ID      |
| DELETE | `/:id` | ADMIN | Delete user by ID      |

### Organizations (`/api/organizations`)

| Method | Path          | Auth   | Description               |
| ------ | ------------- | ------ | ------------------------- |
| GET    | `/`           | ADMIN  | List all organizations    |
| GET    | `/:id`        | ADMIN  | Get organization by ID    |
| GET    | `/slug/:slug` | Public | Get organization by slug  |
| POST   | `/`           | ADMIN  | Create organization       |
| PATCH  | `/:id`        | ADMIN  | Update organization by ID |
| DELETE | `/:id`        | ADMIN  | Delete organization by ID |

### Roles (`/api/roles`)

| Method | Path   | Auth  | Description       |
| ------ | ------ | ----- | ----------------- |
| GET    | `/`    | ADMIN | List all roles    |
| GET    | `/:id` | ADMIN | Get role by ID    |
| POST   | `/`    | ADMIN | Create role       |
| PATCH  | `/:id` | ADMIN | Update role by ID |
| DELETE | `/:id` | ADMIN | Delete role by ID |

### User-Organizations (`/api/user-organizations`)

| Method | Path                            | Auth  | Description                  |
| ------ | ------------------------------- | ----- | ---------------------------- |
| GET    | `/`                             | ADMIN | List all assignments         |
| GET    | `/user/:userId`                 | ADMIN | Org memberships for a user   |
| GET    | `/organization/:organizationId` | ADMIN | Users in an organization     |
| GET    | `/:id`                          | ADMIN | Get assignment by ID         |
| POST   | `/`                             | ADMIN | Assign user to org with role |
| PATCH  | `/:id`                          | ADMIN | Update assignment            |
| DELETE | `/:id`                          | ADMIN | Remove assignment            |

### Health (`/api/health`)

| Method | Path | Auth   | Description     |
| ------ | ---- | ------ | --------------- |
| GET    | `/`  | Public | DB health check |

### Metrics (`/metrics` — outside the `/api` prefix)

| Method | Path       | Auth   | Description                                                                                    |
| ------ | ---------- | ------ | ---------------------------------------------------------------------------------------------- |
| GET    | `/metrics` | Public | Raw Express handler registered in `main.ts` — bypasses prefix, guards, throttler, and transform |

## Request processing pipeline

1. Winston logger (replaces NestJS default)
2. Global prefix `/api`
3. CORS enabled (all origins — default settings)
4. Global `ValidationPipe` — whitelist, forbidNonWhitelisted, transform, enableImplicitConversion
5. Global guards: ThrottlerGuard (10 req/60s) → JwtAuthGuard (respects `@Public()`) → RolesGuard (queries DB for role names across all user's org memberships)
6. `AllExceptionsFilter` — normalizes all errors to `{ statusCode, message, errors?, timestamp, path }`
7. `ResponseTransformInterceptor` — wraps success to `{ statusCode, message: "Success", data, timestamp, path }`

## Authentication

- **Login**: Passport local strategy validates email/password against DB (bcrypt, 10 salt rounds)
- **JWT**: `passport-jwt` verifies Bearer token signed with `JWT_ACCESS_SECRET`; `JwtStrategy.validate()` confirms user still exists in DB
- **RolesGuard**: queries `prisma.userOrganization` for the authenticated user's role names across ALL organizations — a user who is ADMIN in any org is ADMIN everywhere
- **Refresh**: `POST /auth/refresh` requires valid access token; returns new token pair. Incoming refresh token is NOT validated (only access token is checked)
- **Token payload**: `{ sub: user.id, email: user.email }` (see `JwtPayload` interface)

## Environment variables

| Variable                 | Required | Default       | Description                       |
| ------------------------ | -------- | ------------- | --------------------------------- |
| `NODE_ENV`               | No       | `development` | development \| production \| test |
| `PORT`                   | No       | `3000`        | Server port                       |
| `DATABASE_URL`           | Yes      | —             | PostgreSQL connection string      |
| `JWT_ACCESS_SECRET`      | Yes      | —             | Signs access tokens               |
| `JWT_REFRESH_SECRET`     | Yes      | —             | Signs refresh tokens              |
| `JWT_ACCESS_EXPIRATION`  | No       | `15m`         | Access token expiry               |
| `JWT_REFRESH_EXPIRATION` | No       | `7d`          | Refresh token expiry              |

## Module pattern

All business modules follow a 3-layer pattern:

- **Controller** — HTTP handling, decorators (`@ApiTags`, `@Roles`, `@Public`)
- **Service** — thin business logic, delegates to repository
- **Repository** — direct Prisma queries, throws `NotFoundException` on missing entities
- **DTOs** — Create DTO with `class-validator` + Swagger decorators; Update DTO via `PartialType(CreateDto)`

## Code conventions

- Password fields are destructured out before returning user objects
- Update methods cast DTOs to `{ [key: string]: unknown }` before passing to repository
- All Swagger DTOs use `@ApiProperty`/`@ApiPropertyOptional` with example values
- Swagger UI at `/docs` (no global prefix), bearer auth configured

## Known issues / technical debt

- **Minimal test coverage** — only 2 spec files (`metrics.service.spec.ts`, `request-logging.middleware.spec.ts`, from the monitoring task); only 1 e2e test (health endpoint). `npm test` fails due to a jest config conflict (`jest.config.js` and the `jest` key in `package.json` are both present) — run scoped instead: `npx jest <path> --config jest.config.js`. Note: `test/jest-e2e.json` lacks the `.js`-extension `moduleNameMapper` added to `jest.config.js`, so the e2e spec's `.js` imports may fail to resolve (unverified; e2e requires a live DB)
- **E2E test mismatch** — test setup doesn't apply `AllExceptionsFilter` or `ResponseTransformInterceptor`, so response shape differs from production
- **Unused code**: `ROLES` constants, `BaseResponseDto`, `PaginationDto` are defined but never used
- **`CreateRoleDto.organizationId`** is silently dropped — `RolesRepository.create()` only passes `{ name }`
- **`User.isActive`** is never checked in login, JWT strategy, or guards
- **Token expiry parsing** strips non-digits from strings like `"15m"` → `15`, which may be interpreted as 15 seconds
- **No refresh token verification** — the refresh endpoint only validates the access token
- **No helmet middleware** — no security headers configured
- **CORS allows all origins** — security concern for production
- **Role scoping issue** — roles are global (unique name), not per-organization, despite the junction table design

## Implementation checklist: HTTP request logging + Prometheus metrics + Grafana

Task: add per-request winston logging (method, url, status, duration) and prom-client metrics (`http_requests_total` counter, `http_request_duration_seconds` histogram; labels `method`/`route`/`status`) exposed at `/metrics`, scraped by Prometheus and visualized in Grafana.

### Locked decisions

| Decision                | Choice                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Logging/metrics capture | Raw Express middleware registered in `main.ts` via `app.use()` (NOT an interceptor — guards reject 401/403/429 and unmatched 404 requests before interceptors run; middleware sees everything) |
| Duration + status       | Measured with `performance.now()`; final status read on the `res.on('finish')` event (works even when `AllExceptionsFilter` writes the response) |
| `/metrics` endpoint     | Raw Express handler via `app.use('/metrics', ...)` in `main.ts` — bypasses global prefix `/api`, JWT guard, throttler, and `ResponseTransformInterceptor` (which would JSON-wrap the Prometheus text format) |
| Route label             | Route template from `req.route.path` (join if array), fallback `'unmatched'` when no route matched — avoids label cardinality explosion from UUIDs. Raw `originalUrl` is used for the log line instead |
| Skipped paths           | `/metrics` only (no log line, not counted). `/api/health` stays logged                              |
| Default process metrics | `collectDefaultMetrics()` from prom-client — ENABLED (adds process CPU/memory/event-loop series)     |
| Grafana host port       | `3001:3000` (avoids clash with the app's default dev port 3000)                                     |
| Pinned images           | `prom/prometheus:v3.15.0`, `grafana/grafana:13.0.10`                                                |
| prom-client labels      | All label values coerced to strings (prom-client throws on `undefined`)                             |

### Files to create / modify

- Create `src/modules/metrics/metrics.module.ts` — plain `@Module` (no `@Global()`), provides `MetricsService`, imported by `AppModule`
- Create `src/modules/metrics/metrics.service.ts` — owns a prom-client `Registry`:
  - Counter `http_requests_total` (labels: `method`, `route`, `status`)
  - Histogram `http_request_duration_seconds` (same labels; buckets `0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10`)
  - `collectDefaultMetrics({ register })`
  - `recordRequest(method, route, status, durationSeconds)` — increments counter + observes histogram in one call
  - `getMetrics(): Promise<string>` and a `contentType` getter for the endpoint
- Create `src/common/middleware/request-logging.middleware.ts`:
  - Exported pure helper `getRouteLabel(req)` (unit-testable)
  - Exported factory `createRequestLoggingMiddleware(logger, metricsService)` — calls `next()` immediately, hooks `res.on('finish')`, logs `METHOD originalUrl status durationMs` at winston `info` level with structured meta `{ method, url, status, durationMs, route }` via the injected raw winston logger, records both metrics, skips `/metrics` (bugfix: originally logged at `http` level, which was silently suppressed — the Console transport's default level is `info` and winston npm levels rank http=3 below info=2 in severity)
- Modify `src/main.ts` — resolve `WINSTON_MODULE_PROVIDER` + `MetricsService` via `app.get()`, register the request-logging middleware and the `/metrics` handler (sets `Content-Type` from the registry's `contentType`, `await`s the metrics text before `res.end()` — `no-floating-promises` is enforced as a warning)
- Modify `src/app.module.ts` — add `MetricsModule` to imports
- Create `docker/prometheus/prometheus.yml` — `scrape_interval: 15s`, single job, `metrics_path: /metrics`, static target `app:5000` (service name + container port, NOT the host-mapped port)
- Create `docker/grafana/provisioning/datasources/prometheus.yml` — datasource type `prometheus`, url `http://prometheus:9090`, `isDefault: true`, fixed `uid: prometheus` (dashboard references this uid deterministically)
- Create `docker/grafana/provisioning/dashboards/dashboards.yml` — file-based dashboard provider, path `/var/lib/grafana/dashboards`
- Create `docker/grafana/dashboards/nestjs-overview.json` — panels:
  - Request rate by route: `sum(rate(http_requests_total[5m])) by (route)`
  - Status code distribution: `sum by (status) (rate(http_requests_total[5m]))`
  - p95 latency: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))`
  - p99 latency: same with `0.99`
  - Error ratio: `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))`
  - Process CPU / resident memory from default metrics (`process_cpu_seconds_total`, `process_resident_memory_bytes`)
- Modify `docker-compose.yml` — add `prometheus` (pinned image, port `9090:9090`, read-only mount of `prometheus.yml`, `app-network`, `depends_on: app`) and `grafana` (pinned image, port `3001:3000`, read-only mounts of provisioning + dashboards dirs, named `grafana_data` volume, `GF_SECURITY_ADMIN_USER/PASSWORD=admin/admin` for dev, `depends_on: prometheus`) services, plus the `grafana_data` top-level volume

### Ordered steps (all pending)

- [x] **Step 1 — Install `prom-client`**
  Install with `bun add prom-client` (the Docker dev container installs via bun) AND `npm install prom-client` (keeps `package-lock.json` in sync — repo carries three lockfiles: `package-lock.json`, `yarn.lock`, `bun.lock`).
  Verify: `prom-client` present in `package.json` dependencies; both lockfiles show the addition in `git diff`.

- [x] **Step 2 — Create `MetricsModule` + `MetricsService`**
  Registry, counter, histogram, `collectDefaultMetrics()`, `recordRequest()`, `getMetrics()`, `contentType`. Add `MetricsModule` to `AppModule` imports. All imports use `.js` extensions (nodenext).
  Verify: `npm run lint`, `npx tsc --noEmit`, `npm run build` all clean.
  Outcome: metrics files + `app.module.ts` lint-clean; `npx tsc --noEmit` clean; `npm run build` clean (`dist/modules/metrics` emitted). Repo-wide `npm run lint` exits non-zero from 15 pre-existing errors + 1 warning in unrelated files (current-user.decorator, roles.guard, response-transform.interceptor, auth.service, register.dto, users.repository, main.ts) — pre-dates this step (HEAD had 21 problems); the gate's `--fix` resolved 5 formatting-only issues in auth.module/users.repository/users.service.

- [x] **Step 3 — Create request-logging middleware; wire `/metrics` in `main.ts`**
  `createRequestLoggingMiddleware(logger, metricsService)` + `getRouteLabel(req)` helper; register both middlewares in `main.ts` after `setGlobalPrefix`.
  Verify: lint/tsc/build clean. Then `npm run start:dev` (requires valid `.env`):
  - (a) `curl localhost:3000/api/health` → winston log line `GET /api/health 200 - Xms`
  - (b) `curl localhost:3000/metrics` → Prometheus text format with `http_requests_total` + `http_request_duration_seconds_bucket` and correct `Content-Type` header
  - (c) `curl localhost:3000/api/users` without token → 401 still logged and counted (middleware-sees-everything property)
  - (d) hit a bogus path → route label `unmatched`, status 404
  - (e) hit `/api/users/<uuid>` with admin token → route label `/api/users/:id`, not the raw UUID
  - (f) repeat a request → counter value increments between scrapes
  - (g) `/metrics` requests produce no log lines
  Outcome: static gates pass — scoped eslint on changed files 0 errors (`main.ts` keeps its pre-existing `bootstrap()` floating-promise warning), `npx tsc --noEmit` clean, `npm run build` clean (`dist/common/middleware/` + wired `dist/main.js` emitted, verified in output). Runtime curl smoke test (a)–(g) deferred to parent, to be run separately. Parent smoke (a) surfaced a bug: request lines logged at `http` level were silently suppressed by the Console transport's default `info` level — middleware now logs at `info` level (meta structure unchanged, transport config untouched); fix re-verified with `npx tsc --noEmit` (clean).

- [x] **Step 4 — Add docker config: prometheus scrape + grafana provisioning + compose services**
  All `docker/` files listed above, pinned images `prom/prometheus:v3.15.0` and `grafana/grafana:13.0.10`, Grafana port `3001:3000`.
  Verify: `docker compose config` parses cleanly. NOTE: the compose `app` service uses an anonymous `/app/node_modules` volume, so the image must be rebuilt to pick up `prom-client`: `docker compose build app && docker compose up -d --renew-anon-volumes app` (quick alternative: `docker compose exec app bun add prom-client`).
  Outcome (verified externally by parent): `docker compose config` parses OK, dashboard JSON valid, all 4 config files present (`docker/prometheus/prometheus.yml`, `docker/grafana/provisioning/datasources/prometheus.yml`, `docker/grafana/provisioning/dashboards/dashboards.yml`, `docker/grafana/dashboards/nestjs-overview.json`); `prometheus` + `grafana` services and `grafana_data` volume added to compose. The app-image rebuild note above still applies before Step 5.

- [x] **Step 5 — Start and verify the monitoring stack**
  Verify: `docker compose up -d prometheus grafana`, then:
  - (a) http://localhost:9090/targets shows the `app:5000` target UP
  - (b) querying `http_requests_total` in the Prometheus UI returns samples
  - (c) http://localhost:3001 (admin/admin) → datasource auto-provisioned, dashboard renders
  - (d) generate load (`for i in $(seq 1 50); do curl -s localhost:3000/api/health > /dev/null; done`) → request-rate and latency panels move
  Readiness (static pre-startup checks only; runtime verification owned by parent): all 4 docker config files present and parse-verified (Step 4); both pinned image tags exist on Docker Hub (`prom/prometheus:v3.15.0`, `grafana/grafana:13.0.10`); host port 9090 is free. **Startup blockers on this host** — another project's stack (my-pharmacy) is running and holds: port **3001** (its grafana), **5432** (its postgres), **6379** (its redis), and **3000** (its frontend; our `.env` sets `PORT=3000` so the compose `app` maps `3000:5000`) — `docker compose up` will fail to bind these until the parent either stops that stack or remaps our host ports (a 3001 remap would amend a locked decision, so it is the parent's call). Note: with the pharmacy stack up, Step 5(d)'s `curl localhost:3000` would hit its frontend, not our app. The Step 4 app-image rebuild for `prom-client` (`docker compose build app && docker compose up -d --renew-anon-volumes app`) is also still required before scraping can succeed.
  Blocked (user decision, later resolved): host ports 3000/3001/5432/6379 are occupied by other live stacks (my-pharmacy, incl. `postgres_db` and `redis_cache`) — runtime compose verification was deferred until those ports were free or remapped. Local smoke test of `/metrics` + winston request logs already done and passing on host (app run on port 3100).
  Verified (parent, live stack): `docker compose up` with a `docker-compose.override.yml` (compose project `nestjs-template`, safe host ports: app `3100`, prometheus `39090`, grafana `13001`) — Prometheus target `nestjs-app` health=UP; `http_requests_total` query returns samples (31 total); `histogram_quantile` p95 returns 0.015s; Grafana datasource `Prometheus` auto-provisioned and dashboard `NestJS Overview` present. Infra fix required during startup: `bunx prisma generate` inside the app container (Prisma client not generated in the fresh image).

- [x] **Step 6 — Full gate + docs**
  Verify: `npm run lint && npx tsc --noEmit && npm run build && npm test` all pass; `npm run test:e2e` (requires live DB; note the e2e app doesn't register the raw middlewares — same prod/e2e drift as documented above). Update the Routes section of this file to add `/metrics` (public, raw Express handler, outside the `/api` prefix).
  Outcome (gate run externally by parent): `npx tsc --noEmit` OK; `npm run build` OK; `npm run lint` exits non-zero with 15 errors + 1 warning — all in files untouched by this task (pre-existing; verified at HEAD with 21 problems, the gate's `--fix` earlier resolved 5 formatting-only ones); `npm test` cannot run due to a pre-existing jest config conflict (`jest.config.js` AND the `jest` key in `package.json` are both present) plus no test files in the repo — unrelated to this task. Routes section of this file updated with `GET /metrics` (public, raw Express handler, outside the `/api` prefix). `npm run test:e2e` not part of this gate run.

- [x] **Step 7 — Optional: unit tests**
  `src/modules/metrics/metrics.service.spec.ts` (counter/histogram increments, string label coercion) and a spec for `getRouteLabel`. These would be the first unit tests in the repo (see Known issues).
  Verify: `npx jest src/modules/metrics/metrics.service.spec.ts`.
  Outcome: created `src/modules/metrics/metrics.service.spec.ts` (7 tests: prometheus content type, counter increments per request, distinct label series, numeric-status → string label coercion, histogram bucket placement for 0.12s, histogram count/sum, default process metrics present) and `src/common/middleware/request-logging.middleware.spec.ts` (5 tests for `getRouteLabel`: route template, array-path join, `'unmatched'` fallback for missing/non-string/empty/non-string-array paths). Infra fix required: added `'^(\\.{1,2}/.*)\\.js$': '$1'` to `jest.config.js` `moduleNameMapper` — jest could not resolve the repo's nodenext `.js`-extension relative imports (`Cannot find module './metrics.service.js'`); `test/jest-e2e.json` lacks the same mapper (pre-existing latent issue). Verification: `npx jest src/modules/metrics --config jest.config.js` → 7/7 passed; `npx jest src/common/middleware --config jest.config.js` → 5/5 passed; scoped eslint on both specs 0 problems; `npx tsc --noEmit` clean. `npm test` (unscoped) remains blocked by the pre-existing dual-config conflict documented in Known issues.

### Risks / notes

- `req.route.path` availability depends on Express 5 router internals — Step 3(e) verifies it explicitly; fallbacks are the `'unmatched'` label or deriving the route label from an interceptor instead
- `/metrics` is unauthenticated — acceptable on the internal compose network; the app already publishes port 5000 to the host, so production should not expose `/metrics` publicly
- Grafana admin password is `admin` for dev only — override via compose env vars in real deployments
- Prometheus scrapes target the container port (`app:5000`), not the host-mapped port

## Implementation checklist: GitHub Actions CI

Task: add a single workflow `.github/workflows/ci.yml` (triggers: push to `main`, all `pull_request`) with jobs `quality`, `test`, `build` — all on Node 22 with npm cache. E2E excluded per user decision: this project uses unit tests only going forward. Do not write source code yet; this checklist covers prerequisite repo fixes first, then the workflow, then a local verification gate mirroring every CI command.

### Locked decisions

| Decision                | Choice                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| E2E excluded            | No `e2e` job in CI, no postgres/redis service containers — user decision; test/jest-e2e.json stays unfixed (moduleNameMapper debt remains, out of scope) |
| Unit tests only         | Standing decision: unit tests only for this template — new features must ship with unit tests (`*.spec.ts`) next to the module |
| Lint debt               | The 15 pre-existing eslint errors + 1 warning in `src` files are fixed as part of this task, so CI gates honestly (check-only lint is red from day one otherwise) |
| Unit test scope         | Both spec directories gated: `src/modules/metrics` AND `src/common/middleware` (there are two spec files, one per dir) |
| Artifact upload         | NO `dist/` upload — `build` job just runs `npm run build`                                            |
| Job orchestration       | `test`, `build` gated with `needs: quality` (fast-fail; parallel-from-scratch is wasteful)          |
| Lockfiles               | Three lockfiles remain (`package-lock.json`, `yarn.lock`, `bun.lock`) untouched; `npm ci` reads `package-lock.json` only — lockfile cleanup is a separate follow-up task |
| Lint command in CI      | `npx eslint "src/**/*.ts" "test/**/*.ts"` check-only — the `lint` npm script bakes in `--fix` and must NOT be used in CI |

### Ordered steps (all pending)

- [x] **Step 1 — Fix the 15 pre-existing eslint errors + 1 warning in src files**
  Run `npx eslint "src/**/*.ts" "test/**/*.ts"` to list all current problems. Known instances: `no-unused-vars` (unused imports like `User` in some files), `no-unsafe-call` in `src/main.ts` at `21:11` and `26:11`, plus issues in current-user.decorator, roles.guard, response-transform.interceptor, auth.service, register.dto, users.repository. Apply minimal, behavior-preserving changes only (remove unused imports, narrow `unknown` before property access, etc.). Do NOT widen existing rule overrides in `eslint.config.mjs` as a shortcut.
  Verify: `npx eslint "src/**/*.ts" "test/**/*.ts"` exits 0 (or 0 errors + only the accepted `bootstrap()` floating-promise warning); `npx tsc --noEmit` clean; `npm run build` clean; scoped unit tests still pass (`npx jest src/modules/metrics src/common/middleware --config jest.config.js`).
  Outcome: verified locally — check-only eslint exits 0 (no errors), `npx tsc --noEmit` clean, scoped jest passes 12/12 (7 metrics + 5 middleware).

- [x] **Step 2 — Create `.github/workflows/ci.yml`**
  Single workflow, triggers `push` (branches: `main`) + `pull_request`. Three jobs only (no `e2e`).
  - **Job `quality`**: `actions/checkout@v4` → `actions/setup-node@v4` (`node-version: 22`, `cache: npm`) → `npm ci` → `npx prisma generate` → `npx eslint "src/**/*.ts" "test/**/*.ts"` (check-only, NO `--fix`) → `npx tsc --noEmit`.
  - **Job `test`** (`needs: quality`): same checkout/setup-node/npm-ci steps → `npx jest src/modules/metrics src/common/middleware --config jest.config.js` (explicit `--config jest.config.js` because repo-wide `npm test` is blocked by the known dual-config conflict — `jest.config.js` AND the `jest` key in `package.json` are both present).
  - **Job `build`** (`needs: quality`): same checkout/setup-node/npm-ci steps → `npm run build`. No artifact upload (see Locked decisions).
  Verify: `node -e "JSON.stringify(require('./.github/workflows/ci.yml'))"` is NOT applicable (YAML not JSON) — instead validate structure by inspection or `docker run --rm -v "$PWD/.github/workflows/ci.yml:/w.yml" mikefarah/yq -e '.jobs | has("quality")' /w.yml` if docker unavailable, simplest: `npx yaml-lint .github/workflows/ci.yml` or visually confirm; minimum: file exists at correct path and `git status` shows only intended changes.
  Outcome: `.github/workflows/ci.yml` created and validated with `python3 -c "import yaml; yaml.safe_load(...)"` — 3 jobs (`quality`, `test` needs quality, `build` needs quality), Node 22 + npm cache, concurrency group with cancel-in-progress on PRs, triggers push `main` + `pull_request`; no e2e job, no services, no secrets; descriptively named steps.

- [x] **Step 3 — Final local verification gate (same commands as CI)**
  Run in order and confirm all green:
  1. `npm ci` (fresh install from package-lock.json)
  2. `npx prisma generate`
  3. `npx eslint "src/**/*.ts" "test/**/*.ts"` (exit 0)
  4. `npx tsc --noEmit` (exit 0)
  5. `npx jest src/modules/metrics src/common/middleware --config jest.config.js` (12 tests pass: 7 metrics + 5 middleware)
  6. `npm run build` (exit 0, `dist/` emitted)
  Then push to a branch / open PR and confirm all 3 jobs green on the GitHub Actions UI.
  Outcome: gate passed locally — eslint check-only exit 0, `npx tsc --noEmit` clean (TSC_OK), scoped jest 12/12 passed, `npm run build` succeeded (BUILD_OK).

### Risks / notes

- `test/test-setup.ts` (loaded only via `jest.config.js` `setupFilesAfterEach` — i.e. the unit job) loads a local `.env` via dotenv and sets stale env-var names (JWT_SECRET_KEY, DATABASE_HOST, …) that nothing reads; benign in CI (no `.env` present, dotenv call is a no-op) but noted as future cleanup
- The e2e setup (`test/jest-e2e.json` + `test/app.e2e-spec.ts`) remains in the repo but is NOT gated by CI anymore — the `.js`-extension moduleNameMapper debt and prod/e2e middleware drift stay as documented in Known issues; revisit only if e2e is re-scoped

## Implementation checklist: Documentation set (docs/PRD.md, docs/API_CONTRACT.md, docs/DB_DESIGN.md)

Task: write the v1 documentation set for the upcoming MinIO file-upload feature — DOCS ONLY. No source code, no Prisma schema edits, no migrations, no compose/MinIO changes, no interceptor/filter changes. The docs define the TARGET contract for the feature; implementing it (files module, envelope swap, module removals) is a separate future task.

**NOTE — the Architecture / Database schema / Routes / Authentication sections earlier in this file are STALE relative to HEAD (`1d31ef8`).** Verified drift: the roles + user-organizations modules and their tables no longer exist; email (nodemailer) and Google OAuth modules exist; `User` now has a required `organizationId` FK and a `RoleName` enum; login returns only `{accessToken, refreshToken}`; the refresh endpoint is `POST /api/auth/refresh-token`. The Grounding facts below supersede those sections for this task.

### Grounding facts (verified against HEAD, 2026-10-13)

| Area                    | Fact                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth endpoints          | `POST /auth/register` (public) · `POST /auth/login` (public, LocalAuthGuard) · `GET /auth/verify-token` (JWT, returns `{valid, user}`) · `POST /auth/refresh-token` (public, body `{refreshToken}`) · `POST /auth/set-password` · `POST /auth/change-password` (JWT) · `POST /auth/forgot-password` / `POST /auth/reset-password` (public, email-driven) · `GET /auth/google` + `GET /auth/google/callback` |
| Login return            | `auth.service.ts` `login()` returns `{accessToken, refreshToken}` only — NO `user` field today (deliberate drift vs the documented target)                                                          |
| AuthUser shape          | `{id, email, firstName, lastName, role, organizationId}`                                                                                                                                           |
| `users` table           | id uuid PK, email unique, password, firstName?, lastName?, isActive (default true), forgotPasswordRequest (default false), role `RoleName` (SYSTEM/ADMIN/USER, default USER), createdAt/updatedAt, **organizationId required** FK → organizations (onDelete: Cascade) |
| `organizations` table   | id uuid PK, name, slug unique, logoUrl?, createdAt/updatedAt                                                                                                                                       |
| Modules at HEAD         | auth, email, health, metrics, organizations, users — NO roles/user-organizations (stale sections are wrong), NO files module                                                                      |
| MinIO                   | No `minio` dependency, no compose service — the file-upload feature is greenfield; the docs define the target                                                                                      |
| Response envelope today | `{statusCode, message, data, timestamp, path}` (`ResponseTransformInterceptor`) — differs from the target envelope below                                                                           |
| Infra                   | Global prefix `/api`, global ThrottlerGuard (10 req/60s), global JWT guard (`@Public()` opt-out), Swagger at `/docs`, winston logger, raw `/metrics` handler                                         |
| `docs/`                 | Does not exist — create the directory                                                                                                                                                              |

### Locked decisions

| Decision                     | Choice                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login response shape         | Target: `{accessToken, refreshToken, user}` — per user spec. Docs must note the current code returns only the two tokens (drift is resolved at implementation time, NOT by editing docs to match code) |
| Auth surface after simplify  | Document: register, login, verify-token, refresh-token, change-password. Removed / out of scope: Google OAuth (`google`, `google/callback`), `forgot-password`, `reset-password`, `set-password`     |
| File access control          | Owner + ADMIN (uses the existing `RoleName` enum)                                                                                                                   |
| `uploaded_by` FK             | `ON DELETE RESTRICT` — preserve upload history                                                                                                                      |
| Response envelope (target)   | Success `{success: true, data, message?}`; error `{success: false, error: {code, message, details?}}`. Replaces the current `{statusCode, message, data, timestamp, path}`; the swap itself is future implementation work — docs only define and note it |
| MIME whitelist (v1)          | Images: png, jpg, jpeg, gif, webp · PDF: pdf · Office: doc, docx, xls, xlsx, ppt, pptx · Text: txt, csv, md                                                          |
| Max file size                | 25 MB, enforced server-side → `413 FILE_TOO_LARGE`                                                                                                                  |
| Presigned download           | GET-method presigned URL, 15-minute expiry; `GET /files/:id/url` → `{url, expiresAt}` (ISO 8601)                                                                    |
| Delete semantics             | Soft delete (`status` → `DELETED`); `DELETE /files/:id` → 200 + updated FileUpload; missing OR already-DELETED → `404 FILE_NOT_FOUND`; default list excludes DELETED |
| List defaults                | `page=1`, `limit=20`; `search` = case-insensitive contains on `originalName`; `sort` = `field:asc|desc`, fields `createdAt|originalName|size`, default `createdAt:desc`; response `{items: FileUpload[], total, page, limit}` |
| objectKey format             | Suggested `{userId}/{uuid}-{sanitizedOriginalName}` — uuid guarantees uniqueness; document sanitization rules                                                        |
| Soft delete vs storage       | MinIO object NOT deleted on soft delete; DB row never removed in v1                                                                                                 |
| Writing order                | PRD → DB_DESIGN → API_CONTRACT → consistency pass                                                                                                                   |

### Files to create

- `docs/PRD.md` — product requirements for the standalone file-upload app
- `docs/DB_DESIGN.md` — existing tables + new `file_uploads` table design
- `docs/API_CONTRACT.md` — simplified auth + new files endpoints, envelope, error catalog

### Ordered steps (all pending)

- [x] **Step 1 — Write `docs/PRD.md`**
  Sections: Overview (standalone file-upload service on the existing NestJS template; MinIO objects + PostgreSQL metadata) · Goals v1 (upload with metadata, list/search/sort, detail, time-limited presigned downloads, soft delete) · Functional requirements FR1–FR5 (FR1 upload to bucket `app-uploads`, multipart field `file`, 25 MB max, MIME whitelist; FR2 metadata row in `file_uploads`; FR3 presigned GET URLs, 15-min expiry; FR4 list `page/limit/search/sort`; FR5 soft delete, DELETED excluded from default list) · MIME whitelist table (per Locked decisions) · Non-goals v1 (no public/anonymous sharing links, no chunked/resumable upload, no virus scanning, no checksum dedup, no hard-delete/purge job, no per-org quotas, no thumbnails/image processing, no folders/tagging, no download analytics) · Constraints (JWT on all file routes; 25 MB server-side → 413; sha256 computed server-side for integrity) · Scope changes vs template (REMOVE email + metrics modules, incl. `/metrics` endpoint and prometheus/grafana compose services; auth simplified — no forgot/reset-password email flows) · Dependencies (PostgreSQL, MinIO bucket `app-uploads`, existing JWT auth).
  Verify: every number/list (25 MB, 15 min, whitelist) matches the Locked decisions table exactly; non-goals do not contradict goals.
  Outcome: `docs/PRD.md` created (110 lines, prettier-formatted) with all outlined sections — Overview · Goals v1 · FR1–FR5 · MIME whitelist table · Non-goals (9 items) · Constraints · Scope changes vs template (email + metrics removal, auth simplification incl. Google OAuth/set-password removal, target envelope note) · Dependencies. Verified against the Locked decisions table: 25 MB max, 15-minute presigned expiry, `page=1`/`limit=20` defaults, `createdAt:desc` default sort, bucket `app-uploads`, all 15 whitelist extensions present (png, jpg, jpeg, gif, webp, pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, md); non-goals reviewed against goals — no contradictions (presigned URLs explicitly noted as owner/ADMIN-generated and 15-min-limited so the no-public-sharing non-goal holds). Note: the doc set uses `forgotPasswordRequest` (actual column name — template columns are camelCase, no `@map`), NOT `forgot_password_request`.

- [x] **Step 2 — Write `docs/DB_DESIGN.md`**
  Sections: Overview (PostgreSQL via Prisma v6) · Existing tables — `users` (full current column list incl. required `organizationId` and `RoleName` enum; flag `forgotPasswordRequest` as obsolete after email-flow removal → drop candidate, do not invent removal SQL) and `organizations`; org 1-to-many users relation · New table `file_uploads` — columns: `id uuid PK default gen_random_uuid()`, `bucket text not null default 'app-uploads'`, `object_key text not null unique`, `original_name text not null`, `mime_type text not null`, `size_bytes integer not null check (size_bytes > 0)`, `checksum text not null`, `status text not null default 'ACTIVE' check (status in ('ACTIVE','DELETED'))`, `uploaded_by uuid not null references users(id) on delete restrict`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null` · Indexes: `uploaded_by`, `created_at desc`, `checksum` · Prisma model mapping — equivalent `model FileUpload` block with `@@map("file_uploads")` + a raw SQL DDL sketch · Design notes (objectKey format per Locked decisions; soft-delete semantics — status flag, rows never removed; MinIO object retained on soft delete; `bucket` stored per-row for future multi-bucket; checksum purpose = integrity, NOT dedup, aligning with the PRD non-goal; DB row written after the MinIO put — not atomic, note as an implementation concern).
  Verify: existing-table columns cross-checked against `prisma/schema.prisma`; the API field `size` ↔ DB column `size_bytes` mapping is stated explicitly.
  Outcome: `docs/DB_DESIGN.md` created (175 lines, prettier-formatted) — Overview · existing `users`/`organizations` tables (all columns verified against `prisma/schema.prisma` AND all 6 migration SQL files; actual types documented: ids are TEXT holding uuids, timestamps TIMESTAMP(3), `role` is PG enum `"RoleName"`; `forgotPasswordRequest` flagged obsolete → drop candidate, no removal SQL invented) · relationships (mermaid ER, org→users CASCADE, users→file_uploads RESTRICT) · full `file_uploads` column spec with the 3 indexes · Prisma `model FileUpload` (`@@map("file_uploads")`, `@map` snake_case bridging, `@db.Timestamptz(6)`, `onDelete: Restrict` relation) · raw SQL DDL sketch · 8 design notes. Key reconciliation documented: the locked "uuid" id/`uploaded_by` types are stored as TEXT to match the template's `users.id` (FK types must match; altering `users.id` out of scope) — DDL uses `gen_random_uuid()::text`, Prisma uses client-side `@default(uuid())`. Also noted: Prisma has no CHECK-constraint syntax → the two CHECKs (`size_bytes > 0`, `status IN ('ACTIVE','DELETED')`) must be hand-added to the generated migration SQL. `size` ↔ `size_bytes` mapping stated explicitly in the field-mapping table.

- [x] **Step 3 — Write `docs/API_CONTRACT.md`**
  Sections: Conventions (base `/api`, Bearer JWT, JSON; `multipart/form-data` for upload) · Target envelope (per Locked decisions; explicit note that it replaces the current `{statusCode, message, data, timestamp, path}` shape) · Auth endpoints — `POST /auth/login` `{email, password}` → `{accessToken, refreshToken, user}` (target; note the code drift), `POST /auth/register`, `GET /auth/verify-token` → `{valid, user}`, `POST /auth/refresh-token` `{refreshToken}` → `{accessToken, refreshToken, user}`, `POST /auth/change-password` `{currentPassword, newPassword}`; User object `{id, email, firstName, lastName, role, organizationId}`; removed endpoints listed as out of scope (google, google/callback, forgot-password, reset-password, set-password) · Files endpoints — `POST /files/upload` (multipart field `file`) → FileUpload; `GET /files?page&limit&search&sort` → `{items, total, page, limit}`; `GET /files/:id` → FileUpload (404 `FILE_NOT_FOUND` for missing OR soft-deleted); `GET /files/:id/url` → `{url, expiresAt}`; `DELETE /files/:id` → 200 + updated FileUpload; access control owner + ADMIN · FileUpload object — field table: `id` uuid, `bucket`, `objectKey`, `originalName`, `mimeType`, `size` (bytes), `checksum` (sha256 hex), `status` ACTIVE|DELETED, `uploadedBy` uuid, `createdAt`, `updatedAt` · Error catalog — 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`/`TOKEN_EXPIRED`, 404 `FILE_NOT_FOUND`, 413 `FILE_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE`, 429 `RATE_LIMITED`, 500 `INTERNAL_ERROR`/`MINIO_UNAVAILABLE` — each with a sample error body · One curl example per endpoint (happy path + at least one error).
  Verify: existing auth routes cross-checked against `src/modules/auth/auth.controller.ts`; every response field matches the Step 2 spec; `/api` prefix used consistently.
  Outcome: `docs/API_CONTRACT.md` created (496 lines, prettier-formatted) — Conventions (base `/api`, Bearer JWT, token lifetimes 15m/7d, JSON + multipart for upload, throttle 10/60s) · target envelope with explicit replacement note for the current `{statusCode, message, data, timestamp, path}` shape · auth endpoints (login → `{accessToken, refreshToken, user}` with code-drift note, register → 201 + User incl. auto-org/ADMIN-role note, verify-token, refresh-token, change-password; request rules grounded in the actual DTOs incl. min-length-8 password rules) · User object table · removed endpoints listed (google, google/callback, forgot-password, reset-password, set-password) · files endpoints (upload 201, list `{items, total, page, limit}` with query rules + USER-own/ADMIN-all scope + limit clamp 100, get-by-id, presigned URL `{url, expiresAt}` +15min, DELETE 200 + soft-delete semantics) · FileUpload field table (all 11 fields matching Step 2, with `size`↔`size_bytes` and `uploadedBy`↔`uploaded_by` mapping notes) + sample JSON · error catalog (all 9 codes with sample bodies) · one curl per endpoint (10 happy paths) + error examples (401 login, 415 upload, 400 list sort, 404 get). Verified: controller's 10 routes exactly = 5 documented + 5 removed-listed; all 9 error codes present; all 10 curl examples use `localhost:3000/api`.

- [x] **Step 4 — Cross-file consistency pass (no new files)**
  Check: identical terminology across the three files (`size` API field vs `size_bytes` DB column, mapping stated in both directions); 25 MB / MIME whitelist / 15 min identical in PRD and API contract; error codes in the contract match PRD constraints (413/415); FileUpload fields ↔ `file_uploads` columns mapping consistent; all paths use the `/api` prefix; no references to stale modules except the explicit removal notes.
  Verify: read all three docs end-to-end; `rg -n "25 ?MB|15 ?min|expiresAt|size_bytes" docs/` shows consistent values; optional `npx prettier --check "docs/**/*.md"` (no repo script covers `docs/`).
  Outcome: all three docs read end-to-end and verified — `rg` output shows 25 MB / 15-min / `expiresAt` / `size_bytes` consistent across files; MIME whitelist extension sets identical in PRD §4 and API_CONTRACT §4.1 (diff empty); error codes FILE_TOO_LARGE / UNSUPPORTED_MEDIA_TYPE / RATE_LIMITED / FILE_NOT_FOUND present in both PRD and the API catalog; FileUpload's 11 fields ↔ `file_uploads`' 11 columns mapping consistent (`size`↔`size_bytes` and `uploadedBy`↔`uploaded_by` stated in both directions — DB_DESIGN §4 and API_CONTRACT §5); no unprefixed paths in the PRD; stale modules referenced only in the explicit removal notes (PRD §7, API_CONTRACT §3.7); `npx prettier --check "docs/**/*.md"` passes. **4 minor inconsistencies found and fixed**: (1) API register 201 sample listed `createdAt`/`updatedAt` which the §3.6 User object doesn't define — removed; (2) API §5 objectKey note used the abbreviated `{userId}/{uuid}-{name}` — aligned to `{userId}/{uuid}-{sanitizedOriginalName}` (PRD FR1 / DB_DESIGN §6.1 terminology); (3) PRD §7 endpoint lists lacked the `/api` prefix used by the PRD's FR sections — rewritten to full `/api/auth/...` paths; (4) PRD FR2 column enumeration omitted `id` — added. Note: API_CONTRACT's §3/§4 headers use controller-relative paths by declared convention (§1 states base URL `http://<host>:<port>/api`; all curl examples use full `/api` URLs) — unambiguous, left as is.

### Risks / notes

- The docs describe the TARGET state — where a locked decision deliberately differs from current code (login `user` field, response envelope, removed auth endpoints), the docs win; do not "fix" them to match the code
- The stale Architecture / Database schema / Routes / Authentication sections earlier in this file must NOT be used as a source for these docs — use the Grounding facts table above
- `forgotPasswordRequest` on `users` becomes obsolete once email flows are removed — flag as a drop candidate in DB_DESIGN only; no migration is written in this task
- No format/lint gate covers `docs/` (`npm run format` is scoped to `src/` and `test/`) — a prettier check is optional
- Refreshing the stale Architecture/Routes/DB sections of this file is a separate follow-up task, explicitly out of scope here
