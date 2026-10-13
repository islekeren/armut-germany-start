# Auth Recovery Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Deliver ARM-40 and ARM-22 on codex/arm-40-arm-22-auth-recovery and open a PR.
**Architecture:** Persist device sessions and a per-user authentication version.
Hash recovery tokens and atomically consume them. Keep email transport separate.
**Tech Stack:** NestJS, Prisma/Postgres, JWT, Socket.IO, Next.js, Jest, Vitest.
**Spec:** ../specs/2026-10-13-auth-recovery-design.md

## Global Constraints

- Logout revokes current session only; password change/reset revoke all sessions.
- Seven-day absolute sessions, 15-minute access tokens, 30-minute recovery expiry.
- Minimum eight-character passwords, 60-second persisted request cooldown.
- English/German states. No provider provisioning or invented sender identity.
- Local mailbox only in development/test. No tokens or personal data in logs.

## Review Focus

- Login concurrent with password changes must not restore authorization.
- Concurrent reset consumption succeeds once, and sibling tokens are invalidated.
- Socket recipients revoked on another instance receive no private events.
- Email transport errors cannot disclose whether an account exists.
- Refresh racing logout cannot create a new session.

### Task 1: Device sessions

**Files:** prisma/schema.prisma and migration; auth/session.service.ts;
auth.service.ts, jwt.strategy.ts, auth.controller.ts; messages.gateway.ts/modules.
**Interfaces:** SessionService.create(userId, authVersion), validate(sub, sid),
revoke(userId, sid); AuthService.logout(userId, sid). JWTs use sub/sid/type.

- [x] Write HTTP tests: two logins, logout first rejects access/refresh but second
  works; password change rejects both sessions and legacy JWTs.
- [x] Run tests and observe missing behavior.
- [x] Add session/version migration and validation, password transaction and socket
  event/recipient checks. Refresh reuses sid and never extends session lifetime.
- [x] Run unit and HTTP/socket tests; verify cross-instance recipient revocation.

### Task 2: Recovery and email

**Files:** auth/password-recovery.service.ts, auth/recovery-email.service.ts,
DTO/controller/module, auth-recovery.e2e-spec.ts, email tests; mailbox preview tool.
**Interfaces:** forgotPassword(dto), resetPassword(dto); email.sendReset(to, url,
locale). Recovery tokens contain digest, version, expiry, consumedAt.

- [x] Write failing recovery tests for indistinguishable responses, hashing,
  expiry, reuse, concurrent attempts, sibling tokens, cooldown, deletion and limits.
- [x] Implement row-locked version update and atomic token consumption, generic
  errors, disabled/local/SMTP mail transports and validated frontend URL.
- [x] Run tests including delivery failure and forbidden production local mode.

### Task 3: Web flow

**Files:** auth request/reset pages, shared RecoveryForm, en/de JSON, lib/api.ts,
AuthContext.tsx/tests, authorization route table, web recovery tests.
**Interfaces:** authApi.forgotPassword(email, locale), resetPassword(token, password).

- [x] Write failing both-locale request/reset tests for submitting, generic success,
  malformed/expired fragment, mismatch, network failure and success.
- [x] Implement accessible forms; remove secret fragment after reading; clear
  local auth after password changes; do not pretend failed remote logout succeeded.
- [x] Run frontend tests and existing auth-context regression suite.

### Task 4: Verify and deliver

**Files:** ENVIRONMENT.md, ARCHITECTURE.md, AUTH_RECOVERY.md, env example.

- [x] Document local mailbox, SMTP release requirements, migration, logout and cleanup.
- [x] Run lint/build/check-types, all unit tests, API e2e and web smoke/recovery e2e.
- [x] Review diff and address failures; record environment limitations accurately.
- [x] Commit, push and create PR linking ARM-40/ARM-22, noting beta email setup gate.


## Execution record

Implemented on the requested branch and rebased onto main release-operations
commit 7e31e68. Independent security review found StrictMode initialization,
language-reload token loss, SMTP latency enumeration, and stale reset authentication;
all four were reproduced with regression tests and fixed. Email provider/domain
setup remains intentionally outside this implementation and is a beta release gate.

Final checks: lint/build/check-types pass; API unit 355, web unit 59, shared/UI unit 7; API e2e 330; Chromium e2e 70. Existing API lint warnings and root Expo-config test warnings remain.
