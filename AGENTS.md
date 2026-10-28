# Repository Guidelines

Comprehensive operational guidelines, architectural standards, code patterns, and development workflows for working with the `backend-monorepo` codebase.

---

## Project Overview

`backend-monorepo` is an event-driven, multi-service backend ecosystem orchestrated using **Bun Workspaces** (`bun@1.4.4`) and **Turborepo** (`turbo@^2.11.10`). It hosts 7 independent NestJS backend microservices and 5 shared workspace packages.

### Workspace Services (`apps/`)

| Service | Port | Database | Primary Purpose | Key Technologies |
| :--- | :---: | :--- | :--- | :--- |
| **`ums-service`** | `3001` | `ums_db` | Central Identity Provider, RS256 JWT issuer, RFC 7517 JWKS provider, RBAC, session lifecycle, audit retention | NestJS 11, Prisma 6, RS256, Argon2id, Winston, Prometheus |
| **`cms-service`** | `3002` | `cms_db` | Multi-tenant headless CMS (content types, drafts, versioning, scheduled publishing, media) | NestJS 11, Prisma 6, `@workspace/auth`, MinIO client |
| **`pos-service`** | `3003` | `pos_db` | Retail Point of Sale core (shifts, cash drawer, orders, payments, Kafka transactional outbox) | NestJS 11, Prisma 6, Midtrans, KafkaJS, Outbox pattern |
| **`wms-service`** | `3004` | `wms_db` | Warehouse Management System (bins, stock ledger, FEFO/FIFO allocation, POS Kafka consumer) | NestJS 11, Prisma 6, KafkaJS consumer, Dead-letter queue |
| **`billing-service`** | `3005` | `billing_db` | Centralized payment gateway (Midtrans SNAP/QRIS/VA, HMAC request signature auth, Redis lock & idempotency) | NestJS 11, Prisma 6, Bun runtime, Redis, Outbox relay |
| **`minio-file-service`** | `3006` | `file_db` | S3-compatible file storage wrapper (presigned URLs, MIME filtering, purge background service) | NestJS 11, Prisma 6, MinIO S3 SDK, Schedule |
| **`notification-service`** | `3007` | `notification_db` | Multi-channel notification dispatcher (Email via SMTP/Mailpit, FCM Push, Telegram, WebSockets) | NestJS 11, Prisma 6, BullMQ, Redis, Telegraf, Socket.IO |

### Shared Packages (`packages/`)

| Package | Workspace Import | Purpose & Contents |
| :--- | :--- | :--- |
| **`packages/auth`** | `@workspace/auth` | Downstream authentication utilities: `UmsJwksService` (JWKS caching & fallback), `JwtAuthGuard`, `RolesGuard`, `loadUmsPublicKey`. |
| **`packages/common`** | `@workspace/common` | Standard NestJS utilities: `@Public()`, `@Roles()`, `@CurrentUser()`, `AllExceptionsFilter`, `ResponseTransformInterceptor`, `createRequestLoggingMiddleware`, `AuthUser`, `JwtPayload`. |
| **`packages/events`** | `@workspace/events` | Cross-service Kafka event topic constants (`pos.order.completed`, `pos.order.refunded`, `billing.payment.completed`, `billing.payment.failed`) and TypeScript payload contracts. |
| **`packages/tsconfig`** | `@workspace/tsconfig` | Shared compiler presets (`tsconfig.base.json` for NodeNext/ES2023, `tsconfig.nest.json` for NestJS decorators). |
| **`packages/eslint-config`** | `@workspace/eslint-config` | Shared ESLint 9 flat configuration with `typescript-eslint` and Prettier rules. |

---

## Architecture & Data Flow

```
                           +------------------------------------------------+
                           |           Client / Mobile / POS Frontend       |
                           +-----------------------+------------------------+
                                                   |
                             1. Login / Obtain RS256 JWT
                                                   v
                                        +--------------------+
                                        |    ums-service     | (Port 3001)
                                        | (Identity & RBAC)  |
                                        +---------+----------+
                                                  |
                         Exposes JWKS via HTTP    | RFC 7517: GET /.well-known/jwks.json
                                                  v
     +--------------------------------------------+--------------------------------------------+
     |                                            |                                            |
     v                                            v                                            v
+----+-------------------+               +--------+---------------+                   +--------+---------------+
|      pos-service       |               |      cms-service       |                   |      wms-service       |
| (Port 3003, Order core)|               | (Port 3002, Content)   |                   | (Port 3004, Inventory) |
+----+-------------------+               +--------+---------------+                   +--------+---------------+
     |                                            | Authenticated REST                         ^
     | 2. Order Completed                         v (JWT auto-renewal)                         | 3. Consume Event
     |    (Transactional Outbox)         +--------+---------------+                            |    (FEFO/FIFO Deduct)
     v                                   |   minio-file-service   |                            |
+----+-------------------+               | (Port 3006, S3 Storage)|                            |
|     Apache Kafka       |               +------------------------+                            |
| (localhost:9092)       |---------------------------------------------------------------------+
+----+-------------------+
     ^
     | 4. Payment Completed / Failed (Transactional Outbox)
+----+-------------------+
|    billing-service     | (Port 3005)
| (Midtrans / Lock / Idem|
+------------------------+
```

### Communication Channels

1. **Identity & Token Validation (Decoupled RS256 / JWKS)**:
   - `ums-service` signs access tokens using an asymmetric RS256 private key and publishes public keys via `GET /.well-known/jwks.json`.
   - Downstream services verify tokens locally using `UmsJwksService` (`@workspace/auth`), caching JWKS public keys in-memory for `UMS_JWKS_CACHE_TTL_SECONDS` (default: 3600s).
   - If the JWKS endpoint is unreachable during startup or network isolation, services gracefully fall back to a local static public key (`UMS_JWT_PUBLIC_KEY` or `UMS_JWT_PUBLIC_KEY_PATH`). Zero UMS roundtrips during normal request validation.

2. **Asynchronous Messaging (Kafka + Transactional Outbox Pattern)**:
   - **POS to WMS Inventory Synchronization**: When an order completes or is refunded, `pos-service` persists an event record to its local `OutboxEvent` table within the same database transaction as the order.
   - An asynchronous relay worker (`OutboxRelayService`) polls `PENDING` outbox records and publishes to Kafka topics (`pos.order.completed`, `pos.order.refunded`).
   - `wms-service`'s `PosKafkaConsumer` reads messages with group `wms-service-pos-events`. `PosConsumerService` checks the `ProcessedEvent` table to guarantee idempotent execution before adjusting inventory stock ledgers. Failures are written to `DeadLetterEvent`.
   - **Billing Events**: `billing-service` uses the outbox relay to publish `billing.payment.completed` and `billing.payment.failed`.

3. **Service-to-Service REST & Signature Authentication**:
   - **Resilient HTTP Client**: `InterServiceHttpClient` (`src/common/http-client/http-client.service.ts`) wraps Axios with `axios-retry` (8,000ms timeout, 2 retries on 5xx and network faults).
   - **CMS to MinIO**: `cms-service` uses `HttpFileServiceTokenProvider` (`apps/cms-service/src/modules/media/file-service.client.ts`), caching JWTs and auto-authenticating via machine credentials upon receiving `401`.
   - **Billing HMAC Authentication**: Inter-service billing endpoints enforce `ApiKeyGuard` checking `x-api-key`, `x-timestamp` (enforcing a 5-minute replay window), and `x-signature` calculated via `HMAC-SHA256(secret, method + path + timestamp + body)`.
   - **Internal Worker Token**: `notification-service` protects dispatch endpoints via `InternalAuthGuard` using `crypto.timingSafeEqual` over `INTERNAL_API_TOKEN`.

4. **Background Asynchronous Queuing (BullMQ + Redis)**:
   - `notification-service` enqueues notification dispatch requests into a Redis-backed BullMQ queue (`'notifications'`). Workers run with configurable exponential backoff and jitter to prevent thundering herds against external providers (SMTP, FCM, Telegram).

---

## Key Directories

```text
backend-monorepo/
├── apps/
│   ├── ums-service/              # Central Auth & Identity Provider (Port 3001)
│   ├── cms-service/              # Headless CMS (Port 3002)
│   ├── pos-service/              # Point of Sale Core & Cash Shifts (Port 3003)
│   ├── wms-service/              # Warehouse Management & Stock Ledger (Port 3004)
│   ├── billing-service/          # Billing Gateway & Midtrans Integration (Port 3005)
│   ├── minio-file-service/       # S3 File Storage Management (Port 3006)
│   └── notification-service/     # BullMQ Queue & Notification Dispatcher (Port 3007)
│
├── packages/
│   ├── common/                   # Shared NestJS decorators, filters, interceptors, middleware
│   │   └── src/
│   │       ├── decorators/       # @Public, @Roles, @CurrentUser
│   │       ├── filters/          # AllExceptionsFilter
│   │       ├── interceptors/    # ResponseTransformInterceptor
│   │       ├── interfaces/       # AuthUser, JwtPayload
│   │       ├── middleware/       # createRequestLoggingMiddleware
│   │       └── utils/            # token-expiry, cors-origins
│   ├── auth/                     # UmsJwksService, JwtAuthGuard, RolesGuard
│   ├── events/                   # Kafka event topics & contracts (pos.events.ts, billing.events.ts)
│   ├── tsconfig/                 # tsconfig.base.json & tsconfig.nest.json presets
│   └── eslint-config/            # Shared ESLint 9 flat configuration
│
├── docker/
│   ├── docker-compose.yml        # PostgreSQL (multi-db), Redis, Kafka, MinIO, Mailpit
│   ├── init-db.sh                # Multi-database init script for PostgreSQL
│   └── env.template              # Master environment variable template
│
├── docs/                         # Infrastructure & local service guides
├── contracts/                    # Exported OpenAPI specifications
├── .github/workflows/ci.yml      # GitHub Actions CI workflow
├── package.json                  # Root workspace configuration
└── turbo.json                    # Turborepo task pipeline configuration
```

### Standard Microservice Directory Structure (`apps/<service>/`)

```text
apps/<service>/
├── src/
│   ├── generated/client/         # Generated Prisma Client (git-ignored, mapped in tsconfig)
│   ├── modules/                  # Feature domain modules (Controller -> Service -> Repository)
│   │   └── <feature>/
│   │       ├── dto/              # class-validator DTOs (*.dto.ts and *.dto.spec.ts)
│   │       ├── <feature>.controller.ts
│   │       ├── <feature>.service.ts
│   │       ├── <feature>.repository.ts
│   │       └── <feature>.module.ts
│   ├── common/                   # App-specific guards, strategies, interceptors, utils
│   ├── prisma/                   # PrismaService extending PrismaClient lifecycle
│   ├── app.module.ts             # Root NestJS module registering global guards/filters
│   └── main.ts                   # Application bootstrap script
├── prisma/
│   ├── schema.prisma             # Service-isolated database schema
│   ├── migrations/               # Sequenced SQL migrations
│   └── seed.ts                   # Service seed script (if applicable)
├── test/
│   ├── test-setup.ts             # Global test environment defaults & mocks
│   ├── jest-e2e.json             # E2E test configuration
│   └── app.e2e-spec.ts           # Bootstrapping & health check E2E tests
├── eslint.config.mjs             # Flat ESLint configuration
├── jest.config.js                # Unit test configuration
├── tsconfig.json                 # TypeScript compiler configuration with path mappings
└── tsconfig.build.json           # Production build compiler options
```

---

## Development Commands

All commands run from the monorepo root using **Bun**:

### Infrastructure & Containers

```bash
# Start all local containers (Postgres, Redis, Kafka, MinIO, Mailpit, UIs)
bun run docker:up

# Stop all local containers without destroying volumes
bun run docker:down

# Tail container logs
bun run docker:logs

# Hard reset: wipe all database & storage volumes
docker compose -f docker/docker-compose.yml down -v
```

### Build & Code Generation

```bash
# Generate Prisma Client for all 7 apps (PREREQUISITE for building & testing)
bun run prisma:generate

# Build all packages and applications in topological order
bun run build

# Generate Prisma client for a single service
bun --filter cms-service prisma:generate
# Or inside the service folder:
bun x prisma generate
```

### Running in Development

```bash
# Run all services concurrently with Turborepo
bun run dev

# Run a specific service in development watch mode
bun --filter ums-service start:dev
bun --filter cms-service start:dev
bun --filter pos-service start:dev
bun --filter wms-service start:dev
bun --filter billing-service start:dev
bun --filter minio-file-service start:dev
bun --filter notification-service start:dev
```

### Testing & Quality Assurance

```bash
# Run all unit tests across all workspaces
bun run test

# Run tests with coverage collection
bun run test:cov

# Run end-to-end (E2E) tests across all applications
bun run test:e2e

# Run unit tests for a single workspace
bun --filter ums-service test
bun --filter billing-service test

# Lint all packages and applications
bun run lint

# Format codebase using Prettier
bun run format

# Verify formatting without modifying files
bun run format:check
```

### Database Migrations & Seeding

```bash
# Create and apply a new migration in development (run inside apps/<service>)
cd apps/pos-service && bun x prisma migrate dev --name <migration_name>

# Apply pending migrations in production or CI
cd apps/ums-service && bun x prisma migrate deploy

# Execute service seeders
bun --filter ums-service seed             # Seeds admin user, roles, permissions
cd apps/minio-file-service && bun run bun:seed # Seeds file service admin users
cd apps/cms-service && bun run seed:sites # Seeds demo sites
```

### OpenAPI Contract Generation (Offline / DB-Free)

```bash
# Generates contracts/openapi.json using mock modules without needing running DB
bun --filter ums-service docs:openapi
bun --filter cms-service docs:openapi
bun --filter pos-service docs:openapi
bun --filter billing-service docs:openapi
```

---

## Code Conventions & Common Patterns

### 1. Architectural Layering: Controller -> Service -> Repository -> Prisma

Never inject `PrismaService` directly into controllers or services. Maintain a strict 4-tier separation:

```text
[ Controller ]
      │  @Body(), @Query(), @Param() binding via DTOs
      │  Enforces @Roles(), @Public(), Swagger metadata
      ▼
[ Service ]
      │  Business validation, domain workflows, entity transformation
      ▼
[ Repository ]
      │  Injects PrismaService; encapsulates query filters, paging, projections
      ▼
[ PrismaClient ]
```

#### Example Implementation Pattern

```ts
// 1. DTO (create-tag.dto.ts)
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({ example: 'tech' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: 'Articles related to tech' })
  @IsString()
  @IsOptional()
  description?: string;
}

// 2. Controller (tags.controller.ts)
@ApiTags('Tags')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('sites/:siteId/tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  async create(
    @Param('siteId') siteId: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.tagsService.createTag(siteId, dto);
  }
}

// 3. Service (tags.service.ts)
@Injectable()
export class TagsService {
  constructor(private readonly tagsRepository: TagsRepository) {}

  async createTag(siteId: string, dto: CreateTagDto) {
    const existing = await this.tagsRepository.findByName(siteId, dto.name);
    if (existing) {
      throw new ConflictException(`Tag with name "${dto.name}" already exists`);
    }
    const tag = await this.tagsRepository.create(siteId, dto);
    return tag;
  }
}

// 4. Repository (tags.repository.ts)
@Injectable()
export class TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByName(siteId: string, name: string) {
    return this.prisma.tag.findUnique({
      where: { siteId_name: { siteId, name } },
    });
  }

  async create(siteId: string, data: CreateTagDto) {
    return this.prisma.tag.create({
      data: { siteId, ...data },
    });
  }
}
```

### 2. NodeNext ESM Import Convention

Because the monorepo configures TypeScript `moduleResolution: "nodenext"`, **all relative imports in `.ts` source files must specify the `.js` extension**:

```ts
// CORRECT
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// INCORRECT (Breaks runtime resolution in NodeNext)
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
```

*(Note: Workspace packages and external npm modules are imported normally: `import { JwtAuthGuard } from '@workspace/auth';`)*.

### 3. Dependency Injection & Global Guards

Every service configures standard global guards in its root module (`app.module.ts`):

```ts
// Standard app.module.ts setup
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    // domain modules...
  ],
  providers: [
    UmsJwksService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

- `@Public()` decorator bypasses `JwtAuthGuard` and `RolesGuard`.
- `@Roles('ADMIN', 'MANAGER')` specifies required roles evaluated by `RolesGuard`.
- `@CurrentUser()` extracts `req.user` (type: `AuthUser`). Pass field name for specific property: `@CurrentUser('id') userId: string`.

### 4. Global Interceptors & Exception Filters

Bootstrap files (`src/main.ts`) wire standardized HTTP transformation and error formatting:

```ts
// Standard main.ts pipeline
const app = await NestFactory.create(AppModule, { bufferLogs: true });

app.use(helmet());
app.enableCors({ origin: parseCorsOrigins(configService.get('CORS_ORIGIN')) });

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);

app.useGlobalFilters(new AllExceptionsFilter(logger));
app.useGlobalInterceptors(new ResponseTransformInterceptor());
app.use(createRequestLoggingMiddleware(logger, metricsService));
```

#### Envelope Formats

- **Success (`ResponseTransformInterceptor`)**:
  ```json
  {
    "statusCode": 200,
    "message": "Success",
    "data": { ... },
    "timestamp": "2026-10-28T12:00:00.000Z",
    "path": "/api/users"
  }
  ```
- **Error (`AllExceptionsFilter`)**:
  ```json
  {
    "statusCode": 400,
    "message": "Validation error",
    "errors": ["email must be an email"],
    "timestamp": "2026-10-28T12:00:00.000Z",
    "path": "/api/users"
  }
  ```

### 5. Formatting & Linting Conventions

- **Quotes**: Single quotes (`'`) enforced.
- **Trailing commas**: Enforced on all multi-line structures (`"trailingComma": "all"`).
- **Print width**: 100 characters.
- **Indentation**: 2 spaces.
- **Semicolons**: Always required.
- **Floating Promises**: ESLint rule `@typescript-eslint/no-floating-promises` is set to `warn`. Always `await` async calls or explicitly use `void` for non-awaited promises.
- **File Naming**: Kebab-case naming pattern matching the NestJS convention:
  - Controllers: `<domain>.controller.ts`
  - Services: `<domain>.service.ts`
  - Repositories: `<domain>.repository.ts`
  - Modules: `<domain>.module.ts`
  - DTOs: `<action>-<domain>.dto.ts`
  - Unit Tests: `<filename>.spec.ts`
  - E2E Tests: `<feature>.e2e-spec.ts`

---

## Important Files

### Configuration & Infrastructure

- `package.json`: Root Bun workspaces configuration, global task scripts.
- `turbo.json`: Task dependency graph, caching outputs, and execution pipelines.
- `docker/docker-compose.yml`: Multi-container topology (PostgreSQL, Redis, Kafka, ZooKeeper, MinIO, Mailpit, Kafbat UI, RedisInsight).
- `docker/init-db.sh`: Entrypoint shell script that provisions the 7 independent databases on PostgreSQL container initialization.
- `docker/env.template`: Master environment variable definitions across all services.
- `packages/tsconfig/tsconfig.base.json`: Monorepo TypeScript compiler baseline (`nodenext`, `strictNullChecks`, `ES2023`).
- `packages/eslint-config/eslint.config.mjs`: ESLint 9 flat configuration.

### Shared Libraries (`packages/`)

- `packages/auth/src/ums-jwks.service.ts`: Core client fetching and caching JWKS public keys with static RSA key fallback.
- `packages/auth/src/jwt-auth.guard.ts`: JWT guard respecting `@Public()` metadata.
- `packages/auth/src/roles.guard.ts`: Role-based access control evaluation against `@Roles()` metadata.
- `packages/common/src/filters/all-exceptions.filter.ts`: Central error normalization filter.
- `packages/common/src/interceptors/response-transform.interceptor.ts`: Central response formatting interceptor.
- `packages/common/src/middleware/request-logging.middleware.ts`: Latency measurement and Prometheus metric recorder.
- `packages/events/src/pos.events.ts`: Kafka contract schemas for POS orders.
- `packages/events/src/billing.events.ts`: Kafka contract schemas for payment events.

### Microservice Entry Points & Schemas

| Service | Main Entry Point | Root Module | Prisma Schema |
| :--- | :--- | :--- | :--- |
| `ums-service` | `apps/ums-service/src/main.ts` | `apps/ums-service/src/app.module.ts` | `apps/ums-service/prisma/schema.prisma` |
| `cms-service` | `apps/cms-service/src/main.ts` | `apps/cms-service/src/app.module.ts` | `apps/cms-service/prisma/schema.prisma` |
| `pos-service` | `apps/pos-service/src/main.ts` | `apps/pos-service/src/app.module.ts` | `apps/pos-service/prisma/schema.prisma` |
| `wms-service` | `apps/wms-service/src/main.ts` | `apps/wms-service/src/app.module.ts` | `apps/wms-service/prisma/schema.prisma` |
| `billing-service` | `apps/billing-service/src/main.ts` | `apps/billing-service/src/app.module.ts` | `apps/billing-service/prisma/schema.prisma` |
| `minio-file-service` | `apps/minio-file-service/src/main.ts` | `apps/minio-file-service/src/app.module.ts` | `apps/minio-file-service/prisma/schema.prisma` |
| `notification-service` | `apps/notification-service/src/main.ts` | `apps/notification-service/src/app.module.ts` | `apps/notification-service/prisma/schema.prisma` |

---

## Runtime & Tooling Preferences

### Package Manager & Runtimes

- **Package Manager**: **`Bun`** (`bun@1.4.4`). All dependency installations and lockfile mutations must use `bun install` or `bun add`.
- **Target Runtime Environment**:
  - Services use modern ECMAScript target **`ES2023`** with NodeNext module resolution.
  - Development watcher: standard services use `@nestjs/cli` (`nest start --watch`); `billing-service` runs directly on Bun (`bun --watch src/main.ts`).
  - Production execution: standard services run compiled JavaScript via Node (`node dist/main.js`); `billing-service` executes via Bun (`bun run dist/main.js`).
  - Utility and seed scripts: run using `bun run <script.ts>` or `bun x <binary>`.

### Tooling Constraints

1. **Prisma Generation Path**: Every schema configures `output = "../src/generated/client"`. The generated client lives inside the app's source tree and is mapped in `tsconfig.json` (`"@prisma/client": ["./src/generated/client"]`). Never import Prisma from global `@prisma/client` without running `bun run prisma:generate` first.
2. **Turborepo Task Caching**:
   - `build` depends on `^build` (shared packages build first) and `prisma:generate`.
   - `test` and `test:cov` depend on `prisma:generate`.
   - `test:e2e` depends on `build`.
   - Do not disable pipeline caching unless modifying dynamic script generation tasks.

---

## Testing & QA

### Test Frameworks

- **Unit & Integration Tests**:
  - `ums-service`, `cms-service`, `pos-service`, `wms-service`, `minio-file-service`, and `notification-service` use **Jest v30** with **`ts-jest` v29.2.5**.
  - `billing-service` uses **`bun test`** natively while retaining Jest API compatibility (`jest.fn()`, `describe`, `it`, `expect`).
- **E2E & HTTP Integration**:
  - All services use **Supertest v7** coupled with NestJS `@nestjs/testing` (`Test.createTestingModule(...)`).
- **Unit Test Colocation**:
  - Unit tests live right next to the code being tested (e.g., `src/modules/users/users.service.spec.ts`, `src/modules/users/users.controller.spec.ts`).
- **E2E Test Directory**:
  - Standalone integration suites live in `apps/<service>/test/` (e.g., `app.e2e-spec.ts`).

### Mocking Patterns

1. **PrismaService Mocking**:
   Use `as unknown as PrismaService` or `jest.fn()` mocks for transaction/query isolation:
   ```ts
   const mockPrismaService = {
     user: {
       findUnique: jest.fn(),
       findMany: jest.fn(),
       create: jest.fn(),
       update: jest.fn(),
     },
     $transaction: jest.fn((callbackOrArray) =>
       Array.isArray(callbackOrArray)
         ? Promise.all(callbackOrArray)
         : callbackOrArray(mockPrismaService),
     ),
   };
   ```

2. **JWKS & Auth Mocking in Tests**:
   In `test/test-setup.ts`, test suites configure fallback mock keys and tokens to avoid network dependencies on `ums-service`:
   ```ts
   process.env.UMS_JWKS_URL = 'http://localhost:3001/.well-known/jwks.json';
   process.env.UMS_JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----';
   ```

3. **ESM Dependencies in Jest**:
   `ums-service` maps ESM modules such as `otplib` to a CommonJS mock stub in `test/mocks/otplib.js` via `moduleNameMapper` in `jest.config.js`.

### Coverage Expectations

- Running `bun run test:cov` generates LCOV and text summaries inside `apps/<service>/coverage/`.
- **`billing-service` Coverage Threshold**: Enforces **100% line coverage** on critical payment flows, enforced by `bun run scripts/check-coverage.ts`.
- When adding new domain logic, controllers, or service methods, accompany the changes with corresponding `*.spec.ts` unit tests covering both positive outcomes and thrown exceptions (`NotFoundException`, `ConflictException`, `ForbiddenException`).
