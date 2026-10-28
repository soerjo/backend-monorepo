# Feature Specification: Epic 001 E2E Gate

**Feature Branch**: `feat/epic001-e2e-gate`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Extend the opt-in e2e suite (RUN_E2E=true) with the full Epic 001 recovery and verification journey against a live database — asserting the anti-enumeration contract, one-time token consumption, session revocation on password change, and token retrieval through the documented dev log transport."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Password Recovery Journey end-to-end (Priority: P1)

An operator running the e2e suite against a live service learns that the whole recovery
journey works as the frozen contract promises: request → token delivered (via the dev
log transport) → reset → old sessions dead → old password dead → new password works.

**Why this priority**: This is the acceptance gate for rollout; every contract guarantee
in the recovery half is exercised in one journey.

**Independent Test**: Run the opt-in e2e suite with a live DB and MAIL_TRANSPORT=log;
all recovery assertions pass in one journey.

**Acceptance Scenarios**:

1. **Given** a registered email, **When** forgot-password is called, **Then** the response
   is 200 with a null-data envelope.
2. **Given** an unknown email, **When** forgot-password is called, **Then** the response is
   200 with an envelope byte-equivalent in shape to the registered case, and the response
   times are within a fair threshold of each other (timing assertion).
3. **Given** the log transport captured the reset link, **When** the token is extracted
   and used, **Then** reset-password answers 200.
4. **Given** the new password, **When** login is attempted with it, **Then** a token pair
   is returned; with the old password, login is rejected with 401.
5. **Given** a refresh token from a pre-reset login, **When** it is presented, **Then** it
   is rejected — all old sessions were revoked.
6. **Given** the same reset token a second time, **When** it is used again, **Then** the
   response is 400 with the same message as an invalid token.

### User Story 2 - Email Verification Journey end-to-end (Priority: P1)

The same operator sees the verification half of the epic behave identically to its contract.

**Why this priority**: Verification is the second half of the epic gate; it must prove
token consumption, the never-reset guarantee, and anti-enumeration for resend.

**Independent Test**: Register a new user, verify via the log-captured token, then probe
resend-verification for registered and unknown emails, then replay the used token.

**Acceptance Scenarios**:

1. **Given** a newly registered user, **When** verify-email is called with the log-captured
   token, **Then** the response is 200.
2. **Given** a registered (verified) user's email, **When** resend-verification is called,
   **Then** the response is 200; an unknown email answers 200 with an identical shape.
3. **Given** the already-consumed verification token, **When** it is replayed, **Then** the
   response is 400.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-029**: The e2e suite MUST exercise the full epic 001 journey (recovery + verification)
  when `RUN_E2E=true` with a live database, and MUST remain skipped otherwise.
- **FR-030**: The suite MUST read all configuration from the standard environment
  (`DATABASE_URL`, RS256 key env, `MAIL_TRANSPORT`, `MAIL_LOG_FILE`) — no hardcoded hosts,
  ports, or credentials.
- **FR-031**: The suite MUST retrieve the raw reset and verification tokens through the
  documented dev log transport rather than touching the database.
- **FR-032**: The suite MUST assert the anti-enumeration contract on forgot-password and
  resend-verification: identical response shape for known and unknown emails, and response
  times within a fair threshold.
- **FR-033**: The suite MUST assert one-time token semantics: reuse of a reset or
  verification token answers 400 with the same message as an invalid token.
- **FR-034**: The suite MUST assert that a successful reset revokes all sessions: a refresh
  token issued before the reset must be rejected afterwards.
- **FR-035**: The mail module MUST support an optional `MAIL_LOG_FILE` env that appends each
  log-transport message as a single JSON line to the named file, so a test process can read
  captured links deterministically; when unset, behavior is unchanged (stdout logging only).

### Key Entities *(include if feature involves data)*

- **AuthToken**: exercised through its documented lifecycle (issue → deliver → consume →
  one-time enforcement) without any new attribute.
- **Session**: exercised through its revocation guarantee after password change.
- **User**: exercised through registration, password change, and email verification states.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-014**: With `RUN_E2E=true` and a live DB, the epic 001 journey passes end-to-end in
  one suite run.
- **SC-015**: Without `RUN_E2E=true`, the suite is skipped and the normal unit gates remain
  green (tsc, lint, build, jest).
- **SC-016**: Every anti-enumeration and one-time-token assertion in the epic contract is
  covered by at least one e2e assertion.

## Assumptions

- The runner (Yuna) provisions the live database, applies migrations, seeds, and starts the
  service process with `MAIL_TRANSPORT=log` — the suite only needs standard env.
- The log transport's dev behavior (full link in the log) is documented and intentional;
  the test relies on it as the delivery channel.
- The existing opt-in e2e pattern (`RUN_E2E` describe.skip gating) is the correct home for
  the new journey; no separate test harness is introduced.
