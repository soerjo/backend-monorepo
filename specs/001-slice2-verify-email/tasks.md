# Tasks: Slice 2 — Verify & Resend Email Endpoints

**Feature Branch**: `feat/slice1-password-reset` (continuation commit)

## 1. Repository

- [ ] 1.1 `createEmailVerifyToken(userId, tokenHash, expiresAt)` in `AuthTokensRepository`.
- [ ] 1.2 `findValidEmailVerifyToken(tokenHash)` — hash + `EMAIL_VERIFY` + unused + unexpired.
- [ ] 1.3 `consumeEmailVerifyToken(tokenId, userId)` — transaction: mark used +
  fill `emailVerifiedAt` only when still null (never resets a verified email).

## 2. Service

- [ ] 2.1 `verifyEmail(token)` — valid → consume; not found → the single shared
  `BadRequestException('Token is invalid or expired')`.
- [ ] 2.2 `resendVerification(email)` — issue token only for active unverified users;
  unknown/blocked/verified → dummy argon2id hash + silent return (anti-enumeration).
- [ ] 2.3 `getEmailVerifyTtlHours()` — env `AUTH_TOKEN_TTL_HOURS`, default 24.

## 3. DTOs

- [ ] 3.1 `VerifyEmailDto`.
- [ ] 3.2 `ResendVerificationDto`.

## 4. Controller

- [ ] 4.1 `POST /auth/verify-email` — `@Public()`, `@HttpCode(200)`, throttle 5/60s, Swagger.
- [ ] 4.2 `POST /auth/resend-verification` — same decorators.

## 5. Env

- [ ] 5.1 `AUTH_TOKEN_TTL_HOURS` in `env.validation.ts` (default 24) + `.env.example` doc.

## 6. Contract

- [ ] 6.1 Regenerate `contracts/openapi.json`; CHANGELOG entry for both endpoints + env.

## 7. Tests + Gates

- [ ] 7.1 Unit specs: verify success, shared error for 3 failure modes, replay-after-verify,
  anti-enumeration branches, TTL-hours math.
- [ ] 7.2 All four gates green with raw output; then commit + push (same branch) + PR update.
