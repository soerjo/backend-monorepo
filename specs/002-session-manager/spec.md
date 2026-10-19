# Feature Specification: Epic 002 — Session Manager

**Feature Branch**: `feat/epic002-session-manager`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Session manager endpoints per frozen contract: list own sessions (one current), revoke one session by family, admin views and revokes a user's sessions. Session objects expose id, current, parsed client info, ip, createdAt, expiresAt — never the internal chain fields."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See My Active Sessions (Priority: P1)

A user opens a session list and sees every device currently logged in as them.

**Why this priority**: Visibility is the entry point of session management — without it, revocation is blind.

**Independent Test**: Login twice, list sessions, confirm exactly one entry is flagged current and no internal fields appear.

**Acceptance Scenarios**:

1. **Given** a user with active sessions, **When** the list is requested, **Then** only sessions that are neither revoked nor expired are returned, newest first.
2. **Given** any list response, **When** inspected, **Then** exactly one entry has `current: true`, and no entry contains the internal chain fields.

### User Story 2 - Revoke One Session (Priority: P1)

A user removes a single device's access and the whole session chain behind it dies.

**Why this priority**: This is the actionable half — the user can actually act on what they see.

**Independent Test**: Revoke a non-current session by id; confirm it disappears from the list and its refresh token is dead.

**Acceptance Scenarios**:

1. **Given** a session owned by the caller, **When** it is revoked, **Then** the whole family behind it is revoked and the response is 200 with `data: null`.
2. **Given** a session id that does not exist or belongs to someone else, **When** the revoke is attempted, **Then** the response is 404 with one shared message for both cases.
3. **Given** the current session itself, **When** it is revoked, **Then** the operation succeeds (equivalent to logout).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-036**: System MUST expose `GET /auth/sessions` returning the caller's active sessions (not revoked, not expired), newest first, with exactly one `current: true`.
- **FR-037**: System MUST expose `DELETE /auth/sessions/:id` revoking the session's entire family; success answers 200 with `data: null`.
- **FR-038**: The 404 of session revocation MUST use one identical message for "session does not exist" and "session is not owned by the caller".
- **FR-039**: Revoking the current session MUST be allowed and behave like logout.
- **FR-040**: Session objects MUST expose exactly: `id`, `current`, `client` (`browser`, `os`, `deviceType`), `ip` (nullable), `createdAt`, `expiresAt` — and MUST NOT expose `refreshHash`, `replacedByHash`, or `family`.
- **FR-041**: The `userAgent` MUST be parsed on the server into `browser`, `os`, `deviceType`; unrecognizable values yield `"unknown"` fields, never an error.
- **FR-042**: System MUST expose `GET /users/:id/sessions` (role `ums:admin`) listing the target user's active sessions in the same shape, without the `current` flag.
- **FR-043**: System MUST expose `DELETE /users/:id/sessions` (role `ums:admin`) revoking ALL of the user's sessions, answering 200 with `data: { revoked: <count> }`.
- **FR-044**: Both admin endpoints MUST answer 404 when the user does not exist.
- **FR-045**: The existing `POST /auth/logout-all` MUST remain unchanged.

### Key Entities *(include if feature involves data)*

- **Session**: the record listed and revoked; carries the opaque chain (`refreshHash`, `family`) that MUST stay internal, plus the request metadata shown to users.
- **Client**: the parsed view of the recorded `userAgent` — browser, os, deviceType — computed at read time on the server.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-017**: A caller with multiple logins sees every active session with exactly one current flag and zero internal chain fields.
- **SC-018**: Revoking one session kills its whole family — a refresh token from that family is rejected afterwards.
- **SC-019**: Session ids of other users are unguessable through the 404 channel (one shared message).
- **SC-020**: Admin list/revoke operate on any target user and 404 for nonexistent users.

## Assumptions

- Access-token verification is already stateless and unchanged; the claim payload is not modified by this epic.
- A `lastUsedAt` column is optional: if added, it appears as an additive field on the session object and is recorded in the contract changelog; if not, the contract object shape stands as-is.
- The 3-layer module rule applies: a sessions repository owns all Prisma access; the service orchestrates; controllers hold routes and guards.
