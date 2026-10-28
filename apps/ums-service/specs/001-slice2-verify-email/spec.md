# Feature Specification: Slice 2 — Verify & Resend Email Endpoints

**Feature Branch**: `feat/slice1-password-reset` (continuation commit on the same branch)

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Slice 2 of Epic 001 — POST /auth/verify-email and POST /auth/resend-verification, filling users.emailVerifiedAt via the EMAIL_VERIFY AuthToken type."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Verify Email with Token (Priority: P1)

A user presents a valid EMAIL_VERIFY token to prove ownership of their address.

**Why this priority**: Verification is what turns "we hope the email is theirs" into a proven fact; account recovery depends on it.

**Independent Test**: Submit a valid EMAIL_VERIFY token and confirm the user's emailVerifiedAt becomes non-null and the token cannot be reused.

**Acceptance Scenarios**:

1. **Given** a valid, unused, unexpired EMAIL_VERIFY token, **When** it is submitted, **Then** the user's `emailVerifiedAt` is filled, the token is marked used, and the response is `200` with `data: null`.
2. **Given** a token that is invalid, expired, or already used, **When** it is submitted, **Then** the response is a single shared error message (identical for all three failure modes).

### User Story 2 - Resend Verification (Priority: P1)

A user who has not yet verified their email requests a new verification token.

**Why this priority**: Tokens expire or get lost; without a resend path the user is stuck unverified.

**Independent Test**: Submit an unverified user's email and confirm a fresh EMAIL_VERIFY token is issued behind the scenes with an identical neutral response either way.

**Acceptance Scenarios**:

1. **Given** an email belonging to an active user whose email is not yet verified, **When** it is submitted, **Then** a new `EMAIL_VERIFY` AuthToken is issued and the response is `200` with `data: null`.
2. **Given** an email that is unknown, blocked, or already verified, **When** it is submitted, **Then** the response is identical `200` `data: null` — no observable difference.

### Edge Cases

- What happens when a verified user's token is replayed after verification? The token was consumed during verification; replay returns the shared generic error. The verified state is never reset by token traffic.
- What happens when a user requests a new verification token while an old one is still pending? The old token remains valid independently (both work); no observable difference is exposed either way.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-011**: System MUST expose `POST /auth/verify-email` accepting `{ token }` and returning `200` with `data: null` on success.
- **FR-012**: System MUST expose `POST /auth/resend-verification` accepting `{ email }` and always returning a `200` success envelope with `data: null`, regardless of whether the email is registered, blocked, or already verified.
- **FR-013**: System MUST fill `users.emailVerifiedAt` when a valid EMAIL_VERIFY token is consumed; once filled, token traffic MUST NOT reset it.
- **FR-014**: System MUST accept only a token that is valid (hash matches), unexpired, and unused; all three failure modes MUST return one identical error.
- **FR-015**: System MUST fill `AuthToken.usedAt` when a verification token is consumed, making reuse impossible.
- **FR-016**: System MUST issue a fresh `EMAIL_VERIFY` AuthToken when the email belongs to an active user whose `emailVerifiedAt` is still null; storing only the SHA-256 hash of the opaque token.
- **FR-017**: System MUST compute EMAIL_VERIFY token expiry from the `AUTH_TOKEN_TTL_HOURS` environment variable with a default of 24 hours — never hardcoded.
- **FR-018**: System MUST apply the same throttle policy to `resend-verification` as the existing login/forgot-password endpoints (5 requests / 60 s).
- **FR-019**: System MUST NOT reveal, in any response or log, whether a submitted email exists or is already verified.

### Key Entities *(include if feature involves data)*

- **AuthToken**: Single-use credential of type `EMAIL_VERIFY`; carries a unique SHA-256 hash of the opaque token, an expiry timestamp derived from env TTL hours, and a `usedAt` marker filled on consumption.
- **User**: The account owner whose `emailVerifiedAt` is filled on successful verification.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-006**: A valid EMAIL_VERIFY token fills `emailVerifiedAt` in one request; a second submission fails with the identical generic error.
- **SC-007**: Known-unverified, unknown, blocked, and already-verified emails produce byte-identical success responses.
- **SC-008**: EMAIL_VERIFY token expiry matches the configured `AUTH_TOKEN_TTL_HOURS` within seconds of issuing.
- **SC-009**: `resend-verification` is throttled at the same rate as the existing login endpoint.

## Assumptions

- The existing `AuthToken` model with `EMAIL_VERIFY` type is reused; no schema migration needed.
- Delivery of the raw token (email) remains slice 5's concern; the token is recorded server-side only here.
- The response envelope and global exception filter produce the referenced response shapes.
- The throttle reference is the same policy as `POST /auth/login`.
