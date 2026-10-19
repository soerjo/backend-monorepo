# Technical Plan: Slice 5 — Mail Module

**Feature Branch**: `feat/slice5-mail-module` (branched from slice 1+2 branch)
**Feature Directory**: `specs/001-slice5-mail-module`
**Created**: 2026-10-19

## Overview

A new `mail` module (`src/modules/mail/`) wrapping Nodemailer behind a narrow
interface with two transports selected by env. ADR 0004 governs the design:
direct SMTP from this service, `log` as the dev default, delivery failures
never break token issuance.

## Architecture Alignment

- **Three-Layer Modules (III)**: the mail module is a service-layer concern — no
  controller, no repository, no Prisma. It is consumed by `AuthService` at the exact
  two issuance points (replacing the placeholder debug logs from slices 1–2).
- **Credential Handling (IV)**: real SMTP values are injected via env only;
  `.env.example` carries empty keys.
- **Structured Logging**: one log event per delivery attempt with the recipient, the
  link, the outcome, and never the raw token inside credential material (the link
  contains the token by necessity — it is the FE route; the log mode is dev-only and
  gated by env; production `smtp` mode logs the recipient + outcome, not the link).

## Components

### 1. `src/modules/mail/mail.types.ts` (NEW)

- `MailTransportMode = 'log' | 'smtp'`.
- `MailSendResult = { delivered: boolean; transport: MailTransportMode }`.
- Interface `MailSender` with the two operations:
  `sendPasswordReset(email, token, url)` and `sendEmailVerification(email, token, url)`.
  Both return `Promise<MailSendResult>` and MUST NOT throw (all failures are captured
  into `delivered: false` + structured log).

### 2. `src/modules/mail/mail.module.ts` (NEW)

- Registers `NodemailerMailService` as the `MailSender` provider, exports it.
- Reads `MAIL_TRANSPORT` (default `log`), `SMTP_*`, `MAIL_FROM`, `APP_WEB_URL` via
  `ConfigService`.

### 3. `src/modules/mail/nodemailer-mail.service.ts` (NEW)

- Builds the transport once at construction when mode is `smtp`
  (`host`, `port`, `secure`, `auth`), keeps it private; when mode is `log`, no
  transport object is created.
- Both public operations:
  1. compose subject + text + html bodies from simple templates (text: one-liner with
     the link; html: minimal paragraph + link, no styling framework),
  2. dispatch to `deliver()`:
     - `log` mode: single structured log event with `to`, `subject`, `link` (dev),
       outcome `logged`; no network.
     - `smtp` mode: `transport.sendMail(...)` wrapped in a timeout
       (`AbortSignal.timeout` semantics via a `Promise.race` with a 10 s timer so a
       hanging relay cannot stall the request path), outcome → structured log
       (`to`, `outcome: sent|failed`, error message on failure — never credentials).
  - Every failure path (transport throw, timeout, unknown mode) resolves with
    `delivered: false` — never throws to the caller.
- Token-in-URL handling: the link contains the opaque token (that is how the FE
  consumes it). In `smtp` mode logs record `to` + outcome only; the full link is
  never logged in `smtp` mode, keeping the credential out of persistent logs.

### 4. `src/modules/auth/auth.service.ts` — wire-in

- Inject `MailSender`.
- `requestPasswordReset`: after token issuance, call
  `this.mailSender.sendPasswordReset(user.email, rawToken, buildUrl(APP_WEB_URL, '/reset-password', rawToken))`
  inside a try/catch-free zone (the sender never throws). The placeholder debug log
  from slice 1 is removed.
- `resendVerification`: same with `sendEmailVerification` + `/verify-email`.
- The raw token stays in memory only; nothing about the call changes the response.

### 5. Env — `env.validation.ts` + `.env.example`

- `MAIL_TRANSPORT` (`@IsIn(['log','smtp'])`, optional, default `log`).
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` (`@IsString()`, optional).
- `SMTP_PORT` (`@IsPort()`, optional), `SMTP_SECURE` (`@IsString()`, optional,
  coerced boolean).
- `APP_WEB_URL` (`@IsString()`, optional, default `http://localhost:5173` — ums-ui).
- `.env.example`: all keys present with empty values + comments referencing ADR 0004
  (host/port must be confirmed at hPanel — two Hostinger email products differ).

### 6. Contract artifacts

No endpoint changes — `contracts/openapi.json` is regenerated anyway after wiring
(and must be identical in shape; the CHANGELOG notes the mail slice under `[Unreleased]`
as tooling/behavior-of-issuance, not a contract change to endpoint shapes).

## Testing Strategy

- Unit specs colocated with the mail module:
  - `log` mode: one log event, no network, `delivered` semantics.
  - `smtp` mode: transport constructed from env values; send outcome logged; failure
    (throw/timeout) resolves `delivered: false` without throwing.
  - `AuthService` wiring: issuance calls the sender with the right operation, email,
    and link; a sender failure leaves the endpoint response untouched.
  - Credential hygiene: no `SMTP_PASSWORD` value in any log payload (assert on log mock).
- Gates: tsc / lint / build / jest — all green with raw output attached.

## Risks / Notes

- Nodemailer is a new dependency (constitution-compliant: bun adds it to `bun.lock`).
- Deliverability (SPF/DKIM/DMARC) is DNS work outside this slice — ADR 0004.
- `notification-service` route postponed by ADR 0004; the narrow `MailSender` interface
  is the future swap point.
- `lastUsedAt` on Session: still not touched (epic 002).
