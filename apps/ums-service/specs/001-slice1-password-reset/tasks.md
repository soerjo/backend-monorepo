# Tasks: Slice 1 — Forgot & Reset Password Endpoints

**Feature Branch**: `feat/slice1-password-reset`
**Feature Directory**: `specs/001-slice1-password-reset`

## 1. Repository Layer

- [ ] 1.1 Create `src/modules/auth/auth-tokens.repository.ts` with:
  - `createPasswordResetToken(userId, tokenHash, expiresAt)`
  - `findValidPasswordResetToken(tokenHash)` — hash + `type=PASSWORD_RESET` + `usedAt: null` + `expiresAt > now`
  - `consumePasswordResetToken(tokenHash, newPasswordHash, userId)` — single `$transaction`
    performing: mark token used, update `users.passwordHash`, revoke all active sessions
    for `userId`.

## 2. Service Layer

- [ ] 2.1 Add `requestPasswordReset(email)` to `AuthService`:
  - lookup user via `UsersRepository.findByEmail`
  - if missing or not `ACTIVE` → perform a dummy argon2id hash (timing equalization) and return
  - if found → generate 32-byte opaque token, `sha256Hex` it, compute
    `expiresAt = now + AUTH_TOKEN_TTL_MINUTES(min, default 60)`, insert via repository
- [ ] 2.2 Add `resetPassword(token, newPassword)` to `AuthService`:
  - hash token, `findValidPasswordResetToken`
  - not found → `BadRequestException('Token is invalid or expired')` (single message for
    invalid/expired/used)
  - found → `consumePasswordResetToken(hash, argon2id(newPassword), token.userId)`
- [ ] 2.3 Add private `getPasswordResetTtlMinutes()` reading `AUTH_TOKEN_TTL_MINUTES`
  (default 60).

## 3. DTOs

- [ ] 3.1 Create `src/modules/auth/dto/forgot-password.dto.ts` (`ForgotPasswordDto`).
- [ ] 3.2 Create `src/modules/auth/dto/reset-password.dto.ts` (`ResetPasswordDto`,
  password `@MinLength(8)`).

## 4. Controller

- [ ] 4.1 Add `POST /auth/forgot-password` — `@Public()`, `@HttpCode(200)`,
  `@Throttle({ default: { limit: 5, ttl: 60_000 } })`, Swagger docs.
- [ ] 4.2 Add `POST /auth/reset-password` — same decorators, Swagger docs.

## 5. Module + Env

- [ ] 5.1 Register `AuthTokensRepository` in `AuthModule` providers + exports.
- [ ] 5.2 Add `AUTH_TOKEN_TTL_MINUTES` to `env.validation.ts` (`@IsNumber`, `@IsOptional`,
  default 60) and document in `.env.example`.

## 6. Contract Artifacts

- [ ] 6.1 Run `bun run docs:openapi` and commit updated `contracts/openapi.json`.
- [ ] 6.2 Add `contracts/CHANGELOG.md` entry under `[Unreleased]`.

## 7. Tests

- [ ] 7.1 Colocated unit spec for the new service methods:
  - issuance on active email (token row created, no observable response difference)
  - anti-enumeration: unknown email and blocked email behave identically
  - consumption: valid token → password hash replaced, sessions revoked, token marked used
  - failure modes: invalid, expired, used tokens all produce the same single error message
- [ ] 7.2 Verify all four gates pass with real output:
  `bunx tsc --noEmit`, `bun run lint`, `bun run build`, `bunx jest --config jest.config.js`.

## 8. Delivery

- [ ] 8.1 Commit on `feat/slice1-password-reset`, push, open PR (draft → ready).
