# Feature Specification: Slice 5 — Mail Module (Nodemailer + SMTP Hostinger)

**Feature Branch**: `feat/slice5-mail-module` (branched from slice 1+2 branch)

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Slice 5 of Epic 001 — a mail module wrapping Nodemailer + SMTP Hostinger behind a narrow interface (sendPasswordReset, sendEmailVerification), with a log transport as the default so slices 1–4 run without SMTP credentials. Governed by ADR 0004."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Token Delivery Without SMTP Credentials (Priority: P1)

During development and in any environment without SMTP configuration, issued tokens
still reach a human who needs them: the mail module records the full message body
in the application log instead of sending.

**Why this priority**: Every other delivery mode is blocked until this default works;
it is also the safety net in any environment where SMTP is unconfigured.

**Independent Test**: Run the service with no `MAIL_TRANSPORT` env (or `log`), trigger
a forgot-password flow, and find a structured log entry containing the recipient,
the link, and no credential material.

**Acceptance Scenarios**:

1. **Given** no SMTP env configuration, **When** a password reset token is issued,
   **Then** the message content (to, subject, text body, html body) appears as one
   structured log event and no network connection is attempted.
2. **Given** any transport mode, **When** mail delivery fails, **Then** the failure is
   logged as a structured error and the caller's flow continues unchanged.

### User Story 2 - Real SMTP Delivery (Priority: P1)

In production, tokens reach the user's inbox through the Hostinger SMTP relay.

**Why this priority**: This is the actual delivery mode for real users; without it the
recovery feature exists but never reaches anyone.

**Independent Test**: Configure SMTP env values, trigger the flow, and confirm the
message is accepted by the relay (and appears in a real inbox during a controlled test).

**Acceptance Scenarios**:

1. **Given** `MAIL_TRANSPORT=smtp` with valid `SMTP_*` values, **When** a token is issued,
   **Then** the message is handed to the relay with the configured sender address and the
   link built from `APP_WEB_URL`.
2. **Given** SMTP env values that fail (bad host, refused connection, wrong credentials),
   **When** a token is issued, **Then** the token issuance is not affected: the caller
   still gets its normal response and the failure lands in a structured error log.

### Edge Cases

- What happens when SMTP is configured but the relay is slow or down? The send attempt
  is bounded by a timeout; on timeout the failure is logged and the flow continues.
- What happens when `MAIL_TRANSPORT` contains an unknown value? The module treats it as
  `log` (default), never throws, and logs a warning about the unknown value.
- What happens when `APP_WEB_URL` is unset? Links are built from a localhost default and
  a warning is logged — a misconfigured deployment is visible in logs without breaking
  the token flow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-020**: System MUST provide a mail module exposing exactly two operations:
  `sendPasswordReset(email, token, url)` and `sendEmailVerification(email, token, url)`.
- **FR-021**: System MUST select the transport from the `MAIL_TRANSPORT` env: `log`
  (default) records the message in the log; `smtp` sends via the configured relay.
- **FR-022**: System MUST build the `smtp` transport from `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and stamp messages with `MAIL_FROM`.
- **FR-023**: System MUST build the reset/verification links from `APP_WEB_URL`.
- **FR-024**: System MUST keep real SMTP credentials out of the repository; `.env.example`
  carries empty keys only.
- **FR-025**: System MUST NOT let a mail failure fail token issuance or alter the response
  shape of any endpoint (anti-enumeration rule); failures land in structured error logs.
- **FR-026**: System MUST send both a plain-text and a simple HTML body for each message.
- **FR-027**: System MUST bound the SMTP send attempt with a timeout so a hanging relay
  cannot block the request path indefinitely.
- **FR-028**: System MUST count delivery outcomes (sent vs failed) in existing metrics
  when a metrics facility is present, without introducing new external dependencies.

### Key Entities *(include if feature involves data)*

- **MailMessage**: the outgoing unit — recipient, subject, text body, html body; no
  persistence, no identity of its own.
- **Transport**: the delivery strategy chosen by env (`log` or `smtp`); hidden entirely
  behind the two public operations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-010**: With default env, every issued token produces exactly one structured log
  event containing recipient + link, and zero network attempts.
- **SC-011**: With `MAIL_TRANSPORT=smtp`, a healthy relay accepts the message within the
  configured timeout; the accepted send is observable in logs/metrics.
- **SC-012**: An unhealthy relay leaves token issuance and endpoint responses unchanged
  in every case observed.
- **SC-013**: No SMTP credential value appears in logs, responses, or the repository.

## Assumptions

- ADR 0004 governs: direct SMTP from this service, Hostinger relay, deliverability
  handled outside code (DNS), notification-service route postponed.
- The two operations are the entire public surface — no generic "send any email" escape
  hatch in this slice.
- Link building is a plain string join of `APP_WEB_URL` + path + token query parameter;
  the FE contract (`contract.md` Route frontend section) defines the paths.
