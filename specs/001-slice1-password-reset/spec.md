# Feature Specification: Slice 1 — Forgot & Reset Password Endpoints

**Feature Branch**: `feat/slice1-password-reset`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Slice 1 of Epic 001 — POST /auth/forgot-password and POST /auth/reset-password, using the existing AuthToken model (PASSWORD_RESET type) and revoking all sessions on password change."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Request Password Reset (Priority: P1)

A user submits their email address to start the password recovery flow.

**Why this priority**: This is the entry point for the account recovery journey. Without it, a forgotten password is a dead end.

**Independent Test**: POST to the forgot-password endpoint with a registered email and confirm the 200-envelope response plus a reset token being issued behind the scenes.

**Acceptance Scenarios**:

1. **Given** an email registered to an active user, **When** it is submitted to the forgot-password endpoint, **Then** a `PASSWORD_RESET` AuthToken is issued (single-use, hashed at rest, TTL from env) and the response is always `200` with `data: null`.
2. **Given** an email not registered, **When** it is submitted to the forgot-password endpoint, **Then** the response is identical `200` with `data: null` — no observable difference in shape or timing.

### User Story 2 - Reset Password with Token (Priority: P1)

A user presents a valid reset token and a new password to regain access.

**Why this priority**: This is the actual recovery action; without it the token has no purpose.

**Independent Test**: Take the token produced in User Story 1, submit it with a new password, and confirm the password changed and all sessions were revoked.

**Acceptance Scenarios**:

1. **Given** a valid, unused, unexpired token, **When** it is submitted with a valid new password, **Then** the password hash is replaced (argon2id), the token is marked used, and every active Session for that user is revoked.
2. **Given** a token that is invalid, expired, or already used, **When** it is submitted, **Then** the response is a single shared error message (same for all three failure modes) and nothing changes.

### Edge Cases

- What happens when the same token is submitted twice? The second attempt fails with the same generic error as any other invalid token.
- What happens when the password payload fails validation rules? A validation error is returned before any token consumption.
- What happens when an email is submitted repeatedly within the throttle window? The request is throttled using the same policy as `POST /auth/login`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose `POST /auth/forgot-password` accepting `{ email }` and always returning a `200` success envelope with `data: null`, regardless of whether the email is registered.
- **FR-002**: System MUST expose `POST /auth/reset-password` accepting `{ token, password }` and returning `200` with `data: null` on success.
- **FR-003**: System MUST issue a single-use `PASSWORD_RESET` AuthToken when the email belongs to a registered, non-blocked user, storing only the SHA-256 hash of the opaque token.
- **FR-004**: System MUST compute token expiry from the `AUTH_TOKEN_TTL_MINUTES` environment variable with a default of 60 minutes — never hardcoded.
- **FR-005**: System MUST accept only a token that is valid (hash matches), unexpired, and unused; all three failure modes MUST return one identical error.
- **FR-006**: System MUST fill `AuthToken.usedAt` when a token is consumed, making reuse impossible.
- **FR-007**: System MUST revoke every active `Session` belonging to the user as part of a successful password reset, in the same atomic operation as the password change.
- **FR-008**: System MUST hash the new password with argon2id before persisting.
- **FR-009**: System MUST apply the same throttle policy to both new endpoints as the existing `POST /auth/login` endpoint.
- **FR-010**: System MUST NOT reveal, in any response or log, whether a submitted email exists.

### Key Entities *(include if feature involves data)*

- **AuthToken**: Single-use credential of type `PASSWORD_RESET`; carries a unique SHA-256 hash of the opaque token, an expiry timestamp derived from env TTL, and a `usedAt` marker filled on consumption.
- **User**: The account owner whose password hash is replaced; owns the revoked sessions.
- **Session**: Active login record; all rows for the affected user are revoked on successful reset.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A registered user receives a working reset token whose expiry matches the configured TTL within seconds of issuing.
- **SC-002**: A valid token resets the password in one request; a second submission of the same token fails with the identical generic error.
- **SC-003**: After a successful reset, zero active sessions remain for that user.
- **SC-004**: Registered and unregistered emails produce byte-identical success responses.
- **SC-005**: Both new endpoints are throttled at the same rate as the existing login endpoint.

## Assumptions

- The existing `AuthToken` Prisma model with `PASSWORD_RESET` type, `tokenHash`, `expiresAt`, and `usedAt` fields is reused as-is; no schema migration is needed for this slice.
- Delivery of the token to the user (email) is out of scope for this slice and handled in slice 5; for now the token is recorded server-side only.
- The existing response envelope and global exception filter produce the response shapes referenced above.
- The existing throttle configuration for `POST /auth/login` is the reference policy to reuse.
