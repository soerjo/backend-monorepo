# Technical Plan: Slice 1 — Forgot & Reset Password Endpoints

**Feature Branch**: `feat/slice1-password-reset`
**Feature Directory**: `specs/001-slice1-password-reset`
**Created**: 2026-10-19

## Overview

Two public endpoints for password recovery, built on the existing `AuthToken` model
(`PASSWORD_RESET` type) with opaque tokens hashed via SHA-256, and full session revocation
on successful reset. No schema migration required.

## Architecture Alignment (Constitution)

- **Three-Layer Modules (III)**: Controller (routes + throttle + docs) → Service (business
  rules: anti-enumeration, token issuance/consumption) → Repository (all Prisma access).
  A new `AuthTokensRepository` owns every Prisma call for `AuthToken`.
- **Credential Handling (IV)**: token is a 32-byte opaque base64url string sent to the client
  once; only `sha256Hex(token)` is persisted — same pattern as `Session.refreshHash`.
  New password is hashed with the existing argon2id `hashPassword` util.
- **Stateless Token Verification (II)**: not touched — these endpoints are `@Public()` and
  do not interact with the JWT strategy.
- **Bun-Only + NodeNext (VI)**: all imports use `.js` extensions; gates must pass.

## Components

### 1. Repository — `src/modules/auth/auth-tokens.repository.ts` (NEW)

All Prisma access for `AuthToken`:

- `createPasswordResetToken(userId, tokenHash, expiresAt)` — inserts a `PASSWORD_RESET` row.
- `findValidPasswordResetToken(tokenHash)` — fetches by hash where `type=PASSWORD_RESET`,
  `usedAt: null`, `expiresAt > now` (single query, no separate checks).
- `markUsed(id)` — sets `usedAt = new Date()`.
- `deleteExpiredAndUsedForUser(userId, type?)` — hygiene helper (optional, not required
  for slice 1; omit to keep the surface small).

Throws nothing itself on "not found" — the service decides the (identical) failure
semantics. Only `NotFoundException` semantics are delegated by callers.

### 2. Service — extend `src/modules/auth/auth.service.ts`

Two new methods, plus one shared private helper:

- `requestPasswordReset(email: string): Promise<void>`
  - Look up the user by email via `UsersRepository.findByEmail`.
  - If the user is missing, blocked, or anything else fails silently: return without doing
    anything — no exception, no observable difference.
  - If found and `ACTIVE`: generate a 32-byte opaque token, hash it (`sha256Hex`), compute
    `expiresAt = now + AUTH_TOKEN_TTL_MINUTES * 60_000` (env-driven, default 60), insert the
    `PASSWORD_RESET` row via the repository.
  - Return nothing. The controller always responds `200 { data: null }`.
  - Slice 5 will call the mail module here; for now, log a structured event
    (Winston) at `debug` level with the token hash — NOT the raw token — so a dev environment
    can complete the flow without SMTP. In production the log is silent.

- `resetPassword(token: string, newPassword: string): Promise<void>`
  - Hash the incoming token with `sha256Hex`, call
    `findValidPasswordResetToken(hash)` on the repository.
  - If not found (covers invalid / expired / used — all indistinguishable):
    `throw new BadRequestException('Token is invalid or expired')` — one message for all
    three cases, no enumeration.
  - If found: run a `prisma.$transaction` inside the repository (or a service-level
    orchestration via two repository calls in one transaction — decision below):
    - update `users.passwordHash` to `argon2id(newPassword)`,
    - mark the token used (`usedAt = new Date()`),
    - revoke all `Session` rows (`revokedAt = new Date()`) where `userId` matches and
      `revokedAt IS NULL`.
  - Transaction ownership decision: the transaction must span three tables (`users`,
    `auth_tokens`, `sessions`). The repository cannot own a cross-repository transaction
    cleanly, so the service orchestrates: `this.prisma.$transaction(async (tx) => { ... })`
    with Prisma calls passed `tx`. To respect "all Prisma calls live in the repository"
    (III), the transaction itself is owned by a single repository method
    `consumePasswordResetToken(tokenHash, newPasswordHash, userId)` that performs all three
    mutations atomically and returns nothing. This keeps Prisma access fully inside the
    repository layer.

- `private getPasswordResetTtlMinutes(): number` — reads `AUTH_TOKEN_TTL_MINUTES`
  from `ConfigService`, coerces to integer, defaults to `60`.

### 3. DTOs — `src/modules/auth/dto/forgot-password.dto.ts`, `dto/reset-password.dto.ts` (NEW)

- `ForgotPasswordDto`: `email: string` — `@IsEmail()`, `@IsNotEmpty()`, Swagger-annotated.
- `ResetPasswordDto`: `token: string` (`@IsString()`, `@IsNotEmpty()`), `password: string`
  (`@IsString()`, `@MinLength(8)` — matching the existing register password policy).

### 4. Controller — extend `src/modules/auth/auth.controller.ts`

Two new routes, both `@Public()` and `@HttpCode(200)`:

- `POST /auth/forgot-password` — `@Throttle({ default: { limit: 5, ttl: 60_000 } })`
  (identical to login), `@ApiOperation` with Swagger docs.
- `POST /auth/reset-password` — same throttle + docs.

Both return nothing (the global interceptor wraps to `{ statusCode: 200, message, data: null, ... }`).

### 5. Module wiring — `src/modules/auth/auth.module.ts`

- Add `AuthTokensRepository` to providers (and export it for slice 2 reuse).
- No new module imports — `ConfigModule` is already global.

### 6. Env — `src/config/env.validation.ts` + `.env.example`

- Add `AUTH_TOKEN_TTL_MINUTES` (`@IsNumber()`, `@IsOptional()`, default 60) to the
  `EnvironmentVariables` class, and document it in `.env.example`.
- Slice 2 adds `AUTH_TOKEN_TTL_HOURS` in its own commit; kept separate to match slice boundaries.

### 7. Contract artifacts

- `bun run docs:openapi` regenerates `contracts/openapi.json` (drift-check expects the new
  endpoints).
- `contracts/CHANGELOG.md` gains an entry under `[Unreleased]` describing the two new
  endpoints (additive, non-breaking).

## Testing Strategy

- **Unit (jest, colocated `*.spec.ts`)**: cover the service methods — issuance path (active
  user), anti-enumeration (unknown/blocked email returns silently), token consumption
  (valid → password hash changes + sessions revoked + token marked used), and the three
  failure modes of consumption collapsing into one error. Repository interactions mocked
  via NestJS DI; no live DB required.
- **Not in this slice**: e2e (needs live DB), FE pages (slices 3/4).

## Risks / Notes

- **Timing attack on unknown email**: the unknown-email path skips hashing/token work, so
  response time differs slightly. Mitigation: perform a dummy argon2id hash in the
  unknown-email branch to equalize work — cheap and keeps responses indistinguishable.
- **No email delivery yet**: token issuance is server-side only until slice 5. Dev
  completes the flow by reading the token hash from the DB directly.
- **No `lastUsedAt` on Session**: out of scope (epic 002 slice 1 concern); not added.
