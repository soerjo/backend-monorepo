# Technical Plan: Slice 2 — Verify & Resend Email Endpoints

**Feature Branch**: `feat/slice1-password-reset` (continuation commit)
**Feature Directory**: `specs/001-slice2-verify-email`
**Created**: 2026-10-19

## Overview

Two public endpoints for email verification, mirroring slice 1's token pattern
(`EMAIL_VERIFY` type instead of `PASSWORD_RESET`). Same opaque token + SHA-256
storage, same anti-enumeration posture, same throttle. No schema migration.

## Architecture Alignment (Constitution)

- **Three-Layer Modules (III)**: repository owns all Prisma access (`AuthTokensRepository`
  extends with two EMAIL_VERIFY methods); service holds business rules; controller holds
  routes/throttle/docs.
- **Credential Handling (IV)**: token opaque 32-byte base64url, only `sha256Hex` persisted.
- **Bun-Only + NodeNext (VI)**: unchanged.

## Components

### 1. Repository — extend `AuthTokensRepository`

- `createEmailVerifyToken(userId, tokenHash, expiresAt)` — inserts an `EMAIL_VERIFY` row.
- `findValidEmailVerifyToken(tokenHash)` — by hash, `type=EMAIL_VERIFY`, `usedAt: null`,
  `expiresAt > now`.
- `consumeEmailVerifyToken(tokenId, userId)` — single `$transaction`: mark token used,
  fill `users.emailVerifiedAt` only when still null (idempotent guard: a re-verification
  of an already-verified user never resets the timestamp — conditional update
  `emailVerifiedAt: null` in the `where` clause keeps the truth unchanged even under race).

### 2. Service — extend `AuthService`

- `verifyEmail(token: string): Promise<void>`
  - hash token → `findValidEmailVerifyToken`.
  - not found → `BadRequestException('Token is invalid or expired')` — one message,
    identical to reset-password's (consistent generic error, no enumeration).
  - found → `consumeEmailVerifyToken(token.id, token.userId)`.
- `resendVerification(email: string): Promise<void>`
  - lookup user; if missing, blocked, or `emailVerifiedAt` already set → dummy argon2id
    hash (timing equalizer) and return silently — identical response in every branch.
  - otherwise issue opaque token (32-byte), `sha256Hex`, `expiresAt = now +
    AUTH_TOKEN_TTL_HOURS * 3600_000` (env, default 24), insert via repository.
- `private getEmailVerifyTtlHours(): number` — env `AUTH_TOKEN_TTL_HOURS`, default 24.

### 3. DTOs — NEW

- `VerifyEmailDto`: `token: string` (`@IsString()`, `@IsNotEmpty()`).
- `ResendVerificationDto`: `email: string` (`@IsEmail()`, `@IsNotEmpty()`).

### 4. Controller — extend `AuthController`

- `POST /auth/verify-email` — `@Public()`, `@HttpCode(200)`,
  `@Throttle({ default: { limit: 5, ttl: 60_000 } })`, Swagger docs.
- `POST /auth/resend-verification` — same decorators, Swagger docs.

### 5. Env

- `env.validation.ts`: add `AUTH_TOKEN_TTL_HOURS` (`@IsNumber()`, `@IsOptional()`, default 24).
- `.env.example`: document both TTL knobs in one block.

### 6. Contract artifacts

- `bun run docs:openapi` regenerate; `contracts/CHANGELOG.md` entry for the two endpoints
  + the new env var.

## Testing Strategy

- Unit specs colocated in the auth module: verification success path, the three failure
  modes collapsing to one message, replay-after-verify stays failed, anti-enumeration
  branches (unknown/blocked/verified emails) all silent with timing equalization, TTL
  math for the hours env. All repository interactions mocked — no DB.

## Risks / Notes

- Already-verified user presenting a fresh-but-valid token: the transaction's conditional
  update keeps `emailVerifiedAt` unchanged (never reset) while the token is still marked
  used — matches contract "email terverifikasi tidak di-reset".
- No `lastUsedAt` on Session — epic 002 concern, untouched.
