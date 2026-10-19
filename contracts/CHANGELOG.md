# Contract Changelog

All notable changes to the OpenAPI contract (`contracts/openapi.json`) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of the OpenAPI contract (auto-generated).
- `POST /api/auth/forgot-password` — issue a single-use PASSWORD_RESET token for an
  active user; always responds `200` with `data: null` (anti-enumeration). Throttled
  5 requests / 60 s, same as login. Additive, non-breaking.
- `POST /api/auth/reset-password` — consume a PASSWORD_RESET token, replace the
  password hash (argon2id), and revoke every active session of the user. Single
  shared error for invalid/expired/used tokens. Additive, non-breaking.
- New env: `AUTH_TOKEN_TTL_MINUTES` (default `60`) — TTL of PASSWORD_RESET tokens.
