# ARM-40 and ARM-22: password recovery and session revocation

## Approved scope

Implement both issues together and open a PR against main. The owner approved
implementation on 2026-10-13 with approximately 100 beta users, no domain or email
provider yet, and logout of the current device only. Real delivery remains a beta
release prerequisite; do not invent a sender identity or provision a provider.

## Authentication

Persist AuthSession for each registration/login with an opaque UUID, user ID,
authentication version, seven-day absolute expiry, and revocation timestamp.
Access and refresh JWTs carry the session ID and explicit token type. Refresh
retains the same session and cannot extend its absolute lifetime. Verify the
session, version, active user and expiry in HTTP guards, refresh and sockets.
Logout revokes only the authenticated session. Tabs sharing browser storage share
one session. Password change/reset atomically increment the User authentication
version and invalidate outstanding recovery tokens, revoking every session.

Issue login sessions with the version of the password snapshot actually verified;
a login racing a password change may produce only an unusable old session, never
an authorized new one. Local revocation events evict sockets immediately; socket
events and outgoing deliveries check persistence to enforce across instances.
Preserve deleted-account denial and exclude all internal fields from responses.

## Recovery

Add generic forgot-password responses for known/unknown accounts and delivery
failures, endpoint request/reset throttles, and a persisted 60-second per-account
request cooldown. Generate 32 random bytes as base64url, store SHA-256 digest only,
with 30-minute expiry and the user's authentication version. Reset consumes tokens
atomically; reuse/concurrent consumption and deleted users fail. Successful reset
invalidates every other token and every existing session. Registration, change,
and reset use the existing minimum-eight-character password policy.

Use a configured trusted frontend URL, never request Host headers, for links.
Put the token in a URL fragment to keep it out of HTTP access logs/referrers.
Carry de/en locale in the request and email. The page removes the fragment after
reading it and never logs the secret. Both locales cover request/reset, validation,
network failures, invalid/expired links, submitting and success states.

## Email

Provide an injectable email boundary with disabled, development-local mailbox,
and configurable SMTP transports. Local capture writes private mail files outside
tracked source and offers a loopback-only preview tool; it is rejected outside
explicit development/test runtimes. No raw tokens or personal data are logged.
SMTP credentials and verified sender are external configuration; there is no
chosen beta vendor. Default disabled mode must be documented prominently.

## Rollout and verification

Check in Prisma migration before API deployment. Reject legacy JWTs without
session claims (all users sign in again). Do not run mixed old/new API versions.
Expired session/recovery data has documented cleanup. Verify API service and
HTTP integration behavior, concurrency, throttling, socket sender/recipient checks,
and both-locale frontend states; run repository checks and e2e as documented.
