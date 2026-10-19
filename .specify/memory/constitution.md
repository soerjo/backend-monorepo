<!--
Sync Impact Report:
- Version change: Unversioned Template → 1.0.0
- List of modified principles:
  - [PRINCIPLE_1_NAME] → I. Sole Identity Authority
  - [PRINCIPLE_2_NAME] → II. Stateless Token Verification
  - [PRINCIPLE_3_NAME] → III. Three-Layer Modules
  - [PRINCIPLE_4_NAME] → IV. Credential Handling
  - [PRINCIPLE_5_NAME] → V. Contract Ownership
  - Added: VI. Bun-Only Toolchain with NodeNext Imports
  - Added: VII. PR-Only Delivery with Evidence
  - Added: VIII. Spec Before Code
- Added sections:
  - Platform & Security Constraints (replacing [SECTION_2_NAME])
  - Development Workflow & Quality Gates (replacing [SECTION_3_NAME])
  - Populated Governance rules
- Removed sections: None (all placeholder sections replaced with concrete project standards)
- Follow-up TODOs: None
-->

# ums-service Constitution

## Core Principles

### I. Sole Identity Authority
`ums-service` MUST be the exclusive issuer of platform access tokens across the entire application
ecosystem. All access tokens MUST be signed using asymmetric RS256 with an RSA keypair of at least
2048 bits loaded via `UMS_JWT_PRIVATE_KEY` or `UMS_JWT_PRIVATE_KEY_PATH`. The public key and key ID
(`kid`, formatted as an RFC 7638 JWK thumbprint) MUST be derived deterministically from the private
key, preserving a single source of truth. The private key MUST never leave this service, MUST NOT be
exposed via any endpoint, and MUST NEVER be committed to version control. Downstream services MUST
verify tokens via the public JWKS endpoint (`GET /api/.well-known/jwks.json`).

*Rationale*: Centralizing identity issuance prevents fragmented authentication logic, protects
against credential leakage, and enables downstream consumers to verify tokens without shared secrets.

### II. Stateless Token Verification
Access token verification MUST remain completely stateless. The authentication strategy
(`JwtStrategy`) MUST map claims directly from the verified RS256 token payload (`sub`, `email`,
`name`, `roles`, `orgs`, `perms`) without performing database queries per request. The authorization
guard (`RolesGuard`) MUST evaluate permissions strictly against claims present on the authenticated
request identity (`user.roles.includes(...)`), NEVER querying database tables during guard
execution. The administrative gate protecting privileged endpoints MUST strictly check the
`ums:admin` role claim.

*Rationale*: Eliminating database lookups during token and role verification minimizes latency,
prevents database bottlenecking, and allows high-throughput horizontal scaling across all services.

### III. Three-Layer Modules
Every business domain module MUST follow a strict three-layer architecture:
- **Controller**: Owns HTTP request/response handling, routing, status codes, Swagger documentation,
  and route guards (`@Roles`, `@Public`, `@Throttle`). Controllers MUST NOT execute domain business
  logic or directly invoke Prisma.
- **Service**: Encapsulates business logic, domain invariants, and orchestration. Services MUST
  delegate all database interactions to their respective repository.
- **Repository**: Owns all Prisma database access, queries, and mutations. Repositories MUST throw
  `NotFoundException` when queried entities do not exist. Direct Prisma calls outside repositories
  are strictly prohibited.
- **DTOs**: Input payloads MUST be validated using `class-validator` and documented using
  `@nestjs/swagger` decorators. Update DTOs MUST derive from creation DTOs via `PartialType`.

*Rationale*: Strict layering isolates data access from transport and business concerns, making
modules modular, predictable, and straightforward to unit-test in isolation.

### IV. Credential Handling
User passwords MUST be hashed exclusively with `argon2id` using OWASP-recommended parameters
(19 MiB memory cost, 2 iterations, 1 parallelism thread); weaker algorithms like bcrypt or PBKDF2
are prohibited. Refresh tokens MUST be cryptographically random opaque strings (32-byte base64url)
and MUST be stored in the database exclusively as SHA-256 hashes (`Session.refreshHash`). Plaintext
refresh tokens MUST NEVER be persisted. Every refresh request MUST rotate the refresh token, issuing
a new pair and marking the predecessor as replaced and revoked. If a revoked or already-rotated token
is presented, reuse detection MUST trigger immediately and revoke the entire session `family`.

*Rationale*: Strong password hashing resists modern GPU cracking, while opaque rotated refresh
tokens and automatic family revocation neutralize stolen token reuse and replay attacks.

### V. Contract Ownership
`ums-service` strictly owns its HTTP API contract. The API documentation and OpenAPI specification
MUST be generated directly from source annotations via `@nestjs/swagger` (`SwaggerModule`); API
specifications MUST NEVER be hand-written or maintained in separate schema files. Any breaking
changes to endpoints, routes, response envelopes, or request schemas MUST require formal advance
agreement with downstream consumers.

*Rationale*: Automated generation from code guarantees the contract never drifts from implementation,
while explicit change governance prevents breaking consumer applications in production.

### VI. Bun-Only Toolchain with NodeNext Imports
`bun` is the exclusive package manager and runtime runner for this repository; `bun.lock` is the
sole valid lockfile. Alternative package managers (`npm`, `yarn`, `pnpm`) MUST NOT be used. All
TypeScript code MUST use `module: "nodenext"` and target `ES2023`. Every relative TypeScript import
path MUST explicitly include the `.js` extension (e.g., `import { Foo } from './foo.js'`). Every
code change MUST cleanly pass the local verification gate:
- `bunx tsc --noEmit`
- `bun run lint` (check-only ESLint execution)
- `bun run build` (successful compilation into `dist/`)

*Rationale*: Enforcing a single package manager and standard NodeNext ECMAScript module resolution
avoids dependency lock conflicts and runtime module loading failures across dev and container setups.

### VII. PR-Only Delivery with Evidence
Direct pushes to the `main` branch are strictly prohibited. All functional, architectural, and
governance updates MUST be delivered through Pull Requests and pass the full GitHub Actions CI
pipeline (`quality`, `test`, `build`) before merging. Any claim of task completion, issue closure, or
readiness MUST be backed by verifiable command output (test results, static analysis passes, build
logs, or runtime HTTP execution outputs). Unsubstantiated completion assertions are invalid.

*Rationale*: Branch protection and mandatory CI gates ensure codebase stability, prevent untested
regressions, and maintain a verifiable audit trail for every change.

### VIII. Spec Before Code
All non-trivial development MUST follow the structured specification lifecycle:
**specify → clarify → plan → tasks → implement → converge**. No implementation code may be
written before requirements, data models, and API interfaces have been agreed upon and planned. Work
checklists, task breakdowns, and progress tracking MUST live in GitHub Issues (e.g., populated via
`speckit.taskstoissues`), and MUST NEVER be committed to `AGENTS.md` or other repository documents.

*Rationale*: Designing and clarifying specifications before coding eliminates scope churn and rework,
while tracking transient task lists in GitHub Issues keeps repository documentation clean and durable.

## Platform & Security Constraints

The runtime architecture of `ums-service` is governed by the following platform constraints:
- **Framework & Runtime**: NestJS v11 running on Node.js/Bun with the Express adapter, PostgreSQL
  database (`ums_db`), and Prisma ORM v6.
- **Security Middlewares**: `helmet` MUST be registered at the root of the middleware pipeline. CORS
  MUST default to dev allow-all when `CORS_ORIGINS` is unset, and restrict to the exact listed
  origins when configured.
- **Structured Logging & Metrics**: Application logging MUST use Winston via `nest-winston`
  (Console transport, structured JSON metadata). Passwords, tokens, and authorization headers MUST
  NEVER be logged. Prometheus metrics are exposed at `GET /metrics` via `prom-client` outside the
  global `/api` prefix.
- **Standardized Response Envelope**: All successful HTTP responses MUST be transformed into the
  standard envelope `{ statusCode, message, data, timestamp, path }`. All uncaught exceptions MUST
  be normalized through `AllExceptionsFilter`.
- **Environment & Secrets**: Secrets (`DATABASE_URL`, `UMS_JWT_PRIVATE_KEY`, `UMS_ADMIN_PASSWORD`)
  MUST be injected through environment variables and MUST NEVER be committed to Git.

## Development Workflow & Quality Gates

All contributions MUST satisfy the following quality gates prior to integration:
- **Type Checking**: `bunx tsc --noEmit` MUST complete with 0 errors.
- **Linting**: `bun run lint` MUST complete with 0 errors and 0 warnings.
- **Unit Testing**: Unit tests colocated with modules (`*.spec.ts`) MUST execute via
  `bunx jest --config jest.config.js` and all tests MUST pass.
- **Build Verification**: `bun run build` MUST compile cleanly into `dist/`.
- **Database Migrations**: Any modification to `prisma/schema.prisma` MUST include a generated
  migration file (`bunx prisma migrate dev`) in the same commit, and client generation
  (`bunx prisma generate`) MUST run cleanly.
- **Documentation Hygiene**: Permanent documentation (`README.md`, `DESIGN.md`) MUST be updated when
  contracts or architecture change. Transient task checklists MUST NOT be written to `AGENTS.md`.

## Governance

This Constitution is the highest architectural and operational authority for `ums-service`. Its
mandates supersede all conflicting informal agreements, documentation, or local customs.

- **Amendment Process**: Amendments to this document MUST be submitted via a dedicated Pull Request.
  The PR MUST document the reason for change, the affected principles, and an impact analysis on
  downstream consumers and existing modules.
- **Versioning Policy**: This Constitution follows Semantic Versioning:
  - **MAJOR (X.0.0)**: Removal, fundamental redefinition, or backward-incompatible alteration of core
    principles or governance structures.
  - **MINOR (1.X.0)**: Addition of new principles, new constraints, or material expansion of existing
    guidelines.
  - **PATCH (1.0.X)**: Non-semantic refinements, typographical fixes, wording clarifications, and
    formatting improvements.
- **Compliance & Enforcement**: Every Pull Request MUST be audited for compliance with these
  principles during code review. PRs violating non-negotiable principles MUST NOT be merged without an
  explicit, approved constitutional amendment.

**Version**: 1.0.0 | **Ratified**: 2026-10-19 | **Last Amended**: 2026-10-19
