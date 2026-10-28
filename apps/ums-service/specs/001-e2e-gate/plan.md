# Technical Plan: Epic 001 E2E Gate

**Feature Branch**: `feat/epic001-e2e-gate`
**Feature Directory**: `specs/001-e2e-gate`
**Created**: 2026-10-19

## Overview

Two changes: (1) a small, behavior-additive `MAIL_LOG_FILE` option in the log
transport so a test process can read captured links deterministically; (2) the
epic 001 journey appended to the opt-in e2e suite. No endpoint, schema, or
response-shape changes.

## Component 1 — `MAIL_LOG_FILE` (small change, documented in PR)

`NodemailerMailService.deliver()` in the `log` branch: after (or instead of) the
existing `logger.log(...)` event, when `MAIL_LOG_FILE` is set, append one JSON
line `{ event: 'mail.log-transport', transport: 'log', to, subject, link, at }`
to that file (`appendFileSync`, creating parent dirs on first write). Failure to
write the file is captured (log a warning) and never breaks delivery or the
response — same posture as SMTP failures.

Rationale: stdout capture under jest is fragile (winston transports, buffering,
interleaved process output). A file is deterministic, race-free for sequential
requests, and trivially readable by the test. The PR description asks Yuna's
preference: file (recommended, deterministic) vs stdout capture (fragile under
jest).

## Component 2 — e2e journey (append to `test/auth.e2e-spec.ts`)

Same opt-in pattern (`RUN_E2E` + `describeE2e`), same lazy `AppModule` import.
New `it(...)` blocks sharing one journey:

### Recovery journey
1. Register user A; login → keep `refreshTokenOld` + `accessTokenOld` (proves old
   password works pre-reset).
2. `POST /api/auth/forgot-password` {email A} → 200, `data: null`.
3. Unknown-email probe: `POST /api/auth/forgot-password` {email X} → 200, same
   envelope shape; timing assertion: measure both calls (performance.now around
   each), assert |tRegistered − tUnknown| < 1500 ms (fair threshold; both branches
   pay an argon2 hash so the real gap is small — the threshold only catches gross
   enumeration, not jitter).
4. Read `MAIL_LOG_FILE` (env-set by the runner), find the LAST
   `mail.log-transport` event with `to === emailA` and subject
   'Reset your password'; extract `token` from the link's `?token=` param.
5. `POST /api/auth/reset-password` {token, newPassword} → 200.
6. Login with newPassword → 200 + token pair.
7. Login with oldPassword → 401.
8. `POST /api/auth/refresh` with `refreshTokenOld` → 401 (all old sessions revoked).
9. Replay reset token (second time) → 400; assert the message equals the message
   from an invalid-token attempt (one shared error).

### Verification journey
1. Register user B (fresh email) → 201.
2. `resend-verification` {email B} → 200 (issued; register auto-verifies in v1 —
   to exercise consumption we issue a fresh token through resend).
3. Unknown-email probe: resend for {email X} → 200, identical shape (and timing
   within the same threshold).
4. Read `MAIL_LOG_FILE`, find the LAST `mail.log-transport` event for email B
   with subject 'Verify your email'; extract token.
5. `POST /api/auth/verify-email` {token} → 200.
6. Replay the same token → 400.

Note on register auto-verify: registration fills `emailVerifiedAt` (v1 has no
SMTP). Resend-verification for a verified email answers the neutral 200 without
issuing — so the verification journey issues via resend BEFORE any verification
state exists... which is impossible for an auto-verified user. Resolution: the
journey verifies the CONSUMPTION path through a user whose verification state is
resettable only via DB — which the e2e must not do (no direct DB access from the
test). Adjust: the verify-email consumption assertions (steps 5–6) run against
the token issued by resend for user B; since B is auto-verified at register,
resend issues nothing. Therefore the suite FIRST probes resend-assertions
(anti-enumeration, 200/200 identical) and then exercises verify-email replay
(400) with an INVALID token (same message) plus a used-token replay is only
meaningful if consumption happened. Final adjustment: mark the consumption +
replay assertions as dependent on a `E2E_UNVERIFY=1` runner-provided helper:
when set, the suite calls the documented dev-only DB hygiene endpoint... which
does not exist. Final decision: keep the verification journey to what is
observable through the public API: resend anti-enumeration (200/200 identical +
timing), verify-email with an invalid token → 400 (shared message), and replay
of that same invalid token → 400 (same message — one-time/error-uniformity
assertion holds without needing an unconsumed token). Token consumption for
EMAIL_VERIFY is already covered by unit specs (repository + service level);
the e2e gap is acceptable and documented in the PR. If Yuna wants true
consumption e2e, the runner can seed an unverified user directly in the DB
before the suite (outside the test), and the suite picks it up via env
`E2E_UNVERIFIED_EMAIL` — implement this as an optional branch: when that env is
set, register is skipped and the full consumption flow runs.

## Testing Strategy

- Gates: `bunx tsc --noEmit`, `bun run lint`, `bun run build`, unit jest — all green.
- The e2e suite itself is skipped in gates (no live DB in this container); Yuna
  runs it with `RUN_E2E=true` against the spun-up Postgres (100.64.62.59:55433).
- Runner instructions live in the PR description, not in repo docs.

## Risks / Notes

- Timing threshold is a policy choice: 1500 ms is generous for argon2id-equalized
  branches while still catching a "user not found → instant 200" regression.
- `MAIL_LOG_FILE` writes are synchronous appends — fine for dev/test volumes,
  explicitly out of production hot-path relevance (only active when env set).
- No schema change; no endpoint change; no `lastUsedAt` (epic 002).
