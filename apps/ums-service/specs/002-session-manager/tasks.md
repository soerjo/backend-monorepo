# Tasks: Epic 002 — Session Manager

**Feature Branch**: `feat/epic002-session-manager`

## 1. UA parser (server-side, dependency-free)

- [ ] 1.1 `src/common/utils/user-agent.util.ts` — `parseUserAgent(ua|null)` →
  `{ browser, os, deviceType }`; unknown → all `"unknown"`; colocated spec matrix.

## 2. Repository

- [ ] 2.1 `src/modules/sessions/sessions.repository.ts` — findActiveByUser,
  findByIdAndUser, revokeFamilyBySessionId (txn, returns count|null),
  countActiveByUser, revokeAllActiveByUser, findByHashes.

## 3. Service

- [ ] 3.1 `SessionsService` — listOwn (current flag via refresh hash), revokeOwn
  (shared 404), listForUser (no current flag), revokeAllForUser (404 missing user),
  whitelist mapper `toSessionDto` (FR-040 chain fields structurally excluded).

## 4. Controllers

- [ ] 4.1 `SessionsController` — `GET /auth/sessions`, `DELETE /auth/sessions/:id`
  (auth header + refresh cookie for current flag).
- [ ] 4.2 `UsersController` — `GET /users/:id/sessions`,
  `DELETE /users/:id/sessions` (`@Roles(UMS_ADMIN_ROLE)`), 404 missing user.

## 5. Wiring

- [ ] 5.1 `SessionsModule` + import in `AppModule`; `UsersModule` imports
  `SessionsModule`.

## 6. Contract

- [ ] 6.1 Regenerate `contracts/openapi.json` (4 new endpoints + session schema);
  CHANGELOG additive entries + explicit "lastUsedAt not added" note.

## 7. Gates + Delivery

- [ ] 7.1 Gates green: tsc, lint, build, unit jest (incl. UA parser + mapper specs).
- [ ] 7.2 Commit, push, PR URL.
