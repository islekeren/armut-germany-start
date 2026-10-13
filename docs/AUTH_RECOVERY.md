# Password recovery and device sessions

## Policy and rollout

Every login/registration creates one database session with a seven-day absolute
lifetime. Access tokens last up to 15 minutes; refresh tokens retain the same
session and do not extend its expiry. Logout revokes only that session (tabs
sharing localStorage share a device session). Password change and password reset
invalidate all sessions, including the current device. Sign in again afterward.
Deleted accounts remain denied.

Apply `npm run db:migrate:deploy:api` before deploying the API. Legacy JWTs without
session/type claims are rejected, so all users must sign in again on rollout.
Drain old API instances; a mixed rollout would leave old instances accepting
revoked tokens. Database validation covers HTTP routes, /auth/me, refresh, socket
handshakes/events and private deliveries. Local events disconnect sockets
immediately; other instances reject their events and disconnect them before
private delivery. Idle remote sockets can remain connected until an event,
delivery or token expiry, but cannot retain authorized private access.

## Recovery API

- `POST /api/auth/forgot-password`: `{ email, locale?: "de" | "en" }`; always the
  same generic success response for known/unknown addresses and delivery failures.
- `POST /api/auth/reset-password`: `{ token, newPassword }`; minimum eight
  characters, matching registration and change-password. Invalid, consumed and
  expired tokens fail with 400. A successful reset requires login again.

Requests are limited to five per IP per minute; reset attempts to ten. A persisted
60-second account cooldown also prevents duplicate sends across API instances.
Recovery links expire in 30 minutes. Only a SHA-256 digest is stored in the
recovery table. Consuming a token, changing the password/version and invalidating
sibling tokens commit atomically. Concurrent resets cannot both succeed.

Links use configured FRONTEND_URL, not request headers. The secret and locale are
in a URL fragment, not HTTP query parameters. The reset page clears the fragment
and honors the email locale. Do not add analytics/session recording that captures
form values on recovery pages. Never log email bodies, reset URLs or SMTP errors.

## Local mailbox

No domain or email provider is needed for development. From `apps/api`, configure:

```dotenv
NODE_ENV=development
EMAIL_TRANSPORT=local
EMAIL_LOCAL_DIR=.local-mail
FRONTEND_URL=http://localhost:3000
```

Start API and web normally, then run:

```bash
NODE_ENV=development npm run email:preview --workspace=api
```

Open `http://127.0.0.1:8025`, request a reset at `/forgot-password`, open the captured
message, and follow its link. Capture files contain actual recovery links and
recipients, just like a mail inbox: directory mode 0700, file mode 0600, excluded
from git. Keep them on private storage and delete after testing. Set EMAIL_LOCAL_DIR
to the same absolute path for API and preview if using different working directories.
The preview binds to loopback, rejects foreign Host/Origin, disables caching,
and has no production API route. Local transport refuses production/staging/unset
runtimes. It sends nothing externally.

## Beta release prerequisite

Email defaults to **disabled**. Forgot-password still returns generic success,
but does not create tokens or deliver email. This is not a real-user recovery
service until configured. Before the approximately 100-user beta:

1. Acquire a domain and select a transactional email provider.
2. Verify sender identity and configure SPF/DKIM/DMARC using that provider's guide.
3. Set `EMAIL_TRANSPORT=smtp`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
   `SMTP_PASSWORD`, and an HTTPS `FRONTEND_URL` for the beta.
4. SMTP_SECURE=true uses implicit TLS; false requires STARTTLS. TLS certificate
   verification stays enabled. SMTP logging/debugging are disabled.
5. Test delivery to representative inboxes and verify provider data-processing
   terms, retention and bounce handling before launch.

No provider has been provisioned and no sender domain is assumed. The prior
SendGrid example variables did not represent an integration; they are removed.
The injectable mail service can be replaced with a selected provider's HTTP API
later without changing recovery token logic.

## Retention and testing

Periodically delete expired AuthSession and PasswordResetToken rows using
`expiresAt < now()` (e.g. a daily DBA/scheduled maintenance job). Revoked sessions
are retained until expiry; consumed reset tokens remain until expiry for replay
denial. No cleanup scheduler or production topology is assumed by this repo.
Clear the private local mailbox separately.

Run normal repository unit/checks and API e2e. Browser recovery tests need local
capture explicitly enabled for the API started by Playwright:

```bash
EMAIL_TRANSPORT=local EMAIL_LOCAL_DIR=/tmp/arm-recovery-mail npm --workspace=web run test:e2e -- password-recovery.spec.ts
```

The e2e transport writes fake-user messages only. Recovery browser tests disable
traces/videos because those can contain credentials and reset request bodies.
Actual external SMTP delivery remains unverified until provider setup.
