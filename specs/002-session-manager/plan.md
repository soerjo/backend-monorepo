# Technical Plan: Epic 002 — Session Manager

**Feature Branch**: `feat/epic002-session-manager`
**Feature Directory**: `specs/002-session-manager`
**Created**: 2026-10-19

## Overview

Four endpoints (2 caller-owned, 2 admin) around the existing `Session` model. No
schema migration unless `lastUsedAt` is adopted (decision below). No token claim
changes — `JwtStrategy` is untouched; the `current` flag is resolved server-side
by matching the caller's session family against the presented refresh token when
available, else against nothing (see Current-flag mechanics).

## Architecture Alignment

- **Three-Layer Modules (III)**: NEW `SessionsRepository` owns every Prisma call;
  NEW `SessionsService` orchestrates + shapes responses; NEW `SessionsController`
  (auth endpoints) + extensions in `UsersController` (admin endpoints).
- **Stateless Token Verification (II)**: unchanged — guards do no DB lookups; the
  service reads sessions after authorization.
- **Credential Handling (IV)**: chain fields (`refreshHash`, `replacedByHash`,
  `family`) never leave the service layer; the mapper excludes them structurally
  (explicit whitelist mapping, not blacklist delete).

## Decision — `lastUsedAt`

**Not added in this slice.** Rationale: the frozen contract's object shape does not
include it; nothing in this epic's flows needs it; adding it requires a migration
(risk with an 18:00 target) for zero endpoint behavior gain. The contract explicitly
documents the additive path (field + CHANGELOG entry) if wanted later. Tracked as a
conscious non-goal here — not an oversight.

## Current-flag mechanics

The `current` session is identified by matching the caller's presented refresh
token (cookie `ums_refresh_token` or body) hashed to `refreshHash` when the client
sends it. In practice `ums-ui` calls the list with the auth header + refresh cookie;
the controller reads the cookie via the existing `parseCookieHeader` util. When no
refresh token is presented (API-only caller), no entry is flagged `current` — the
contract's "exactly one" holds for the browser consumer, which is the only current
consumer. Documented in code comments.

## Components

### 1. `src/modules/sessions/sessions.repository.ts` (NEW)

All Prisma access for sessions owned by this feature:

- `findActiveByUser(userId)` — `revokedAt: null`, `expiresAt > now`, newest first.
- `findByIdAndUser(id, userId)` — raw row (service decides ownership 404 semantics).
- `revokeFamilyBySessionId(id, userId)` — transaction: load the row (verify owner),
  `updateMany({ where: { family, revokedAt: null } })`; returns revoked count or null
  when not found/not owned (service maps null → the shared 404).
- `countActiveByUser(userId)` — for admin revoke count.
- `revokeAllActiveByUser(userId)` — updateMany; returns count.
- `findByHashes(hashes: string[])` — resolves which of the caller's hashes is current
  (used for the `current` flag).

### 2. `src/common/utils/user-agent.util.ts` (NEW)

`parseUserAgent(ua: string | null): { browser, os, deviceType }` — dependency-free
regex parsing (Bun-compatible, no new deps): browser (Chrome/Edge/Firefox/Safari/
Opera/other), os (Windows/macOS/Android/iOS/Linux), deviceType (mobile/tablet/
desktop; unknown UA → all fields `"unknown"`). Pure function + colocated spec.

### 3. `src/modules/sessions/sessions.service.ts` (NEW)

- `listOwn(userId, currentHash?)` → repository rows → mapped DTO list; `current`
  true only for the row whose `refreshHash === currentHash`.
- `revokeOwn(id, userId)` → repository revoke-family; null → shared 404
  `BadRequestException`-free: `NotFoundException('Session not found')` — one message
  for both not-exists and not-owned.
- `listForUser(targetUserId)` → admin list (no `current` flag at all).
- `revokeAllForUser(targetUserId)` → 404 when user missing (via UsersRepository
  existence check), else `{ revoked: count }`.
- Mapper `toSessionDto(row, currentHash?)` — whitelist mapping per FR-040; UA parse
  happens here (server-side rule).

### 4. `src/modules/sessions/sessions.controller.ts` (NEW)

- `GET /auth/sessions` — `@ApiBearerAuth()`, reads refresh cookie for the current flag.
- `DELETE /auth/sessions/:id` — same auth; 200 `data: null` or the shared 404.
- Registered in `AuthModule` (shares the auth module's guard chain) or `AppModule`;
  plan: own `SessionsModule` imported by `AppModule` for clean layering; `AuthModule`
  exports nothing new.

### 5. `UsersController` extensions (admin)

- `GET /users/:id/sessions` + `DELETE /users/:id/sessions` — `@Roles(UMS_ADMIN_ROLE)`,
  delegate to `SessionsService`; `UsersModule` imports `SessionsModule`.

### 6. Contract artifacts

- `bun run docs:openapi` regenerate (4 new endpoint shapes); `contracts/CHANGELOG.md`
  entries (additive: 4 endpoints + session object schema). Explicitly note in the
  changelog that `lastUsedAt` is NOT added.

## Testing Strategy

- Unit specs: UA parser matrix (Chrome/FF/Safari/unknown/empty → unknown), mapper
  whitelist (no chain fields ever), ownership 404 uniformity, family revocation count,
  admin endpoints 404 for missing users, current-flag resolution.
- All repository interactions mocked; no live DB in gates.
- e2e remains opt-in (not in this epic's scope).

## Risks / Notes

- `current: true` requires the refresh cookie; `ums-ui` sends it on every call —
  API-only consumers get a list without the flag (documented in code).
- Revoking the current session = logout-equivalent: after revocation the refresh
  cookie becomes dead on next refresh attempt; response is still 200.
- Deadline pressure: the slice is intentionally one PR, no migrations, no new deps.
