# ARM-40 and ARM-22: password recovery and session revocation

## Goal

Implement the acceptance criteria of ARM-40 and ARM-22 together on a separate
branch, validate the API and web flows, and open a pull request against main.

## Proposed authentication policy

Use a persisted integer authentication version on User. Include that version and
an explicit token type in newly issued access and refresh JWTs. Every protected
HTTP request, refresh request, socket connection, socket event, and socket
delivery must verify the current version and active account status.

Password change, password reset, and logout increment the version. Logout is
explicitly **all devices**. This avoids adding a separate per-device session
subsystem. Password changes require logging in again, including on the device
that changed the password. The frontend clears local authentication accordingly.

Alternative: persisted per-device sessions permit current-device logout, but
require session creation, expiry, rotation, cleanup, and additional socket
identity checks. Choose this only if current-device logout is required.

Version updates must be atomic with password updates and reset-token invalidation.
Guard against a login/password change race by issuing tokens with the version of
the account whose password was verified, never a newer version fetched afterward.
Preserve the existing denial of deleted accounts and response sanitization.

Use the existing account-event pattern to disconnect local sockets immediately.
Database checks before events and recipient delivery enforce revocation across
API instances as well. Do not rely exclusively on in-process events.

## Password recovery

Add POST /api/auth/forgot-password and POST /api/auth/reset-password using the
existing DTO and controller conventions. Return the same generic response for
known and unknown email addresses, including delivery failures. Bound request
and reset attempts with endpoint throttles and account-level request cooldowns.
Never return token details through API responses or logs.

Generate 32 random bytes, encode as base64url, and store only the SHA-256 digest
with user ID and a 30-minute expiry. A reset transaction validates and atomically
consumes the token, updates the password, increments the authentication version,
and invalidates all other outstanding tokens. Concurrent reuse must fail.
Deleted accounts cannot request or complete a reset.

Password validation uses the existing registration/change policy: minimum eight
characters. Tests exercise validation, expiry, malformed tokens, reuse,
concurrent consumption, throttling, and indistinguishable API responses.

## Email and frontend

The repository already documents SENDGRID_API_KEY and EMAIL_FROM, but has no
delivery integration. Proposed beta integration: SendGrid using configured,
verified sender credentials. The actual sender identity must be supplied by the
owner; the placeholder noreply@armut.de is not evidence of domain ownership.
No paid service provisioning or live email dispatch is part of implementation.
Document local email testing using a development-only capture transport with no
raw token logging, and document production configuration requirements.

Use a configured trusted frontend URL to build reset links, not request Host
headers. Preserve locale in links and email copy. Prefer URL fragments for the
secret so it does not appear in HTTP access logs or referrer headers.

Replace the forgot-password placeholder with a real request page and add a reset
page. Use the existing auth layout, centralized API client, and both German and
English translation files. Cover submitting, generic request success, validation,
invalid/expired link, network failure, reset success, and return to login.

## Migration and rollout

Add the authentication version and indexed password-reset-token persistence via
a checked-in Prisma migration. Reject old JWTs missing the new claims: deployment
requires all users to sign in again. Run migrations before deploying the API.
Avoid mixed old/new API instances because old code does not enforce revocation.
Document reset-token retention/cleanup and all-devices logout in environment and
auth documentation. Production email sender verification remains a release gate.

## Validation

Add service/controller tests and real API integration tests for password reset,
password change, logout, access/refresh denial, deleted accounts, and two signed-in
sessions. Extend socket integration tests to check existing and new socket access
and revoked recipients. Update the authorization route table for both endpoints.
Add frontend tests for request/reset states in both locales.

Run repository lint, build, type checks, API unit/e2e, and relevant web tests as
required by AGENTS.md and docs/TESTING.md. Report any environment limits accurately
in the PR. Review the final diff for secret leakage and concurrency errors before
opening the PR.

## Required decision before implementation

Confirm all-devices logout and the proposed email configuration approach. Auth
semantics require human clarification under AGENTS.md. The brainstorming skill
also requires review of this written design before implementation planning.
