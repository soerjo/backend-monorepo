# Tasks: Epic 001 E2E Gate

**Feature Branch**: `feat/epic001-e2e-gate`

## 1. MAIL_LOG_FILE support (mail module)

- [ ] 1.1 In `NodemailerMailService.deliver()` log branch: when `MAIL_LOG_FILE` env is
  set, append one JSON line (`event`, `transport`, `to`, `subject`, `link`, `at`) to
  that file (sync append, create parent dirs). File-write failure captured + warned,
  never thrown.
- [ ] 1.2 `env.validation.ts` + `.env.example`: add `MAIL_LOG_FILE` (optional string).

## 2. e2e journey (append to test/auth.e2e-spec.ts)

- [ ] 2.1 Recovery journey: register → login (old password works) → forgot-password
  200 → unknown-email probe 200 same shape + timing window → extract token from
  MAIL_LOG_FILE → reset-password 200 → login new password 200 → login old password
  401 → old refresh token rejected 401 → token replay 400 (same message as invalid).
- [ ] 2.2 Verification journey: register user B → resend-verification 200 (registered)
  → unknown-email resend 200 identical shape → verify-email invalid token 400 → same
  token replay 400 same message. Optional branch: `E2E_UNVERIFIED_EMAIL` env → full
  consumption + replay-400 flow for a runner-seeded unverified user.
- [ ] 2.3 Suite reads config only from env; skipped without RUN_E2E.

## 3. Gates + Delivery

- [ ] 3.1 `bunx tsc --noEmit`, `bun run lint`, `bun run build`, unit jest — green.
- [ ] 3.2 Commit, push, open PR with runner instructions + the file-vs-stdout question.
