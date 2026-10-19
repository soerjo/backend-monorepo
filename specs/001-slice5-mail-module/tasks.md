# Tasks: Slice 5 — Mail Module

**Feature Branch**: `feat/slice5-mail-module` (branched from slice 1+2 branch)

## 1. Module Skeleton

- [ ] 1.1 `src/modules/mail/mail.types.ts` — `MailTransportMode`, `MailSendResult`,
  `MailSender` interface (two operations, never throws).
- [ ] 1.2 `src/modules/mail/nodemailer-mail.service.ts` — transport build from env,
  text+html templates, `deliver()` with log/smtp branches, 10 s send timeout,
  failure captured not thrown.
- [ ] 1.3 `src/modules/mail/mail.module.ts` — register + export `MailSender`.

## 2. Wiring

- [ ] 2.1 `AuthService` injects `MailSender`; replace the two placeholder debug logs
  with real send calls (`/reset-password`, `/verify-email` links from `APP_WEB_URL`).
- [ ] 2.2 `AuthModule` imports `MailModule`.

## 3. Env

- [ ] 3.1 `MAIL_TRANSPORT` + `SMTP_*` + `MAIL_FROM` + `APP_WEB_URL` in
  `env.validation.ts` (optional, defaults per plan) and `.env.example` (empty values,
  ADR 0004 comments).

## 4. Dependency

- [ ] 4.1 Add `nodemailer` + `@types/nodemailer` via bun (`bun.lock` only).

## 5. Contract

- [ ] 5.1 Regenerate `contracts/openapi.json` (no shape change expected);
  CHANGELOG entry describing the mail slice as issuance behavior, not endpoint change.

## 6. Tests + Gates

- [ ] 6.1 Unit specs: log mode single event + no network; smtp mode env build + outcome
  log; failure/timeout resolve `delivered: false`; AuthService wiring (right operation
  + email + link); credential hygiene (no SMTP_PASSWORD in logs).
- [ ] 6.2 Gates green with raw output: tsc, lint, build, jest.
- [ ] 6.3 Commit on `feat/slice5-mail-module`, push, open PR.
