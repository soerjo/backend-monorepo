# Contract Changelog

All notable changes to the OpenAPI contract (`contracts/openapi.json`) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Session manager (epic 002)** — four additive endpoints around session visibility
  and revocation. Session responses are whitelist-mapped: only `id`, `current`,
  `client {browser, os, deviceType}`, `ip`, `createdAt`, `expiresAt` are exposed.
  Chain fields (`refreshHash`, `replacedByHash`, `family`) are structurally excluded.
  The client object is parsed server-side from the stored userAgent string
  (dependency-free parser); unrecognizable or missing UA yields `"unknown"`
  fields, never an error. Revocation is at FAMILY level (token-claim rules
  unchanged); revoked/expired sessions never appear in listings.
  - `GET /auth/sessions` — active sessions of the caller, newest first, with a
    `current:true` flag resolved from the refresh cookie (when absent, no entry
    is flagged current).
  - `DELETE /auth/sessions/:id` — revoke the caller's own session and its whole
    family; `404` with a single shared message for both "does not exist" and
    "not owned by caller" (ownership probing impossible).
  - `GET /users/:id/sessions` — admin (`ums:admin`) view of any user's active
    sessions, same object shape without the `current` flag.
  - `DELETE /users/:id/sessions` — admin revokes ALL of the user's active
    sessions; `404` when the user does not exist, `200 {revoked: n}` otherwise.
- Decision note: `Session.lastUsedAt` was considered and deliberately NOT added
  in this slice — no claim-token change, no new write path.
- Initial release of the OpenAPI contract (auto-generated).
- **Mail module (slice 5, ADR 0004)**: `ums-service` now sends password-reset and
  email-verification messages directly (Nodemailer + SMTP Hostinger). Transport
  selected by `MAIL_TRANSPORT` (`log` default — message recorded in the app log,
  no network; `smtp` — relay built from `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/
  `SMTP_USER`/`SMTP_PASSWORD`, sender stamped with `MAIL_FROM`, links built from
  `APP_WEB_URL`). Mail failures never fail token issuance nor alter endpoint
  responses (anti-enumeration). No endpoint shape change — contract additions
  below remain the only endpoint delta of the epic.
- `POST /api/auth/forgot-password` — issue a single-use PASSWORD_RESET token for an
  active user; always responds `200` with `data: null` (anti-enumeration). Throttled
  5 requests / 60 s, same as login. Additive, non-breaking.
- `POST /api/auth/reset-password` — consume a PASSWORD_RESET token, replace the
  password hash (argon2id), and revoke every active session of the user. Single
  shared error for invalid/expired/used tokens. Additive, non-breaking.
- New env: `AUTH_TOKEN_TTL_MINUTES` (default `60`) — TTL of PASSWORD_RESET tokens.
- `POST /api/auth/verify-email` — consume an EMAIL_VERIFY token, fill
  `users.emailVerifiedAt` (verified email is never reset by token traffic).
  Single shared error for invalid/expired/used tokens. Additive, non-breaking.
- `POST /api/auth/resend-verification` — issue a fresh EMAIL_VERIFY token for an
  active unverified user; always `200` `data: null` regardless of email state
  (anti-enumeration). Throttled 5/60s. Additive, non-breaking.
- New env: `AUTH_TOKEN_TTL_HOURS` (default `24`) — TTL of EMAIL_VERIFY tokens.
