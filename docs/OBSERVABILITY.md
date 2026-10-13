# Beta observability

The API emits JSON logs on stdout for Railway's runtime log viewer. Vercel runtime logs receive sanitized server-side API failure reports. Browser network/server failures and route render errors send a small, best-effort report to the API. No monitoring provider is provisioned by this change.

## Health and release identity

| Endpoint | Meaning | Failure behavior |
| --- | --- | --- |
| `GET /api/health` | Process liveness; does not probe dependencies | Existing status/timestamp response |
| `GET /api/health/ready` | Database readiness via `SELECT 1`, plus safe release commit | 503 on DB failure or 1000ms response deadline; no connection/error details |
| `GET /release` on the web | Deployed web commit only | Missing/invalid commit is `unknown`; response is uncached |

Use database readiness for Railway deploy health checks and external uptime checks. Liveness alone cannot establish that marketplace requests work. The deadline limits readiness response time, not cancellation of an in-flight Prisma query. Do not use readiness as a high-frequency load probe.

Redis is currently not wired as a runtime dependency: the cache uses memory. Storage is not included in readiness so an S3 outage does not take browsing/auth offline. Uploads degrade with their existing errors; verify upload/read/delete separately with a staging fixture. Payment readiness and webhook reconciliation remain the responsibility of the payment integration.

## Trace a failed marketplace operation

Every HTTP response carries `X-Request-ID`. A validated UUID request header is reused, otherwise the API generates one. The web API client supplies correlation IDs and retains the validated response ID on `ApiError.requestId`.

`http_request` logs contain the request ID, HTTP method, registered route **template**, status and duration. They do not contain raw URLs, query strings, concrete booking/user identifiers, headers, cookies, request/response bodies or exception text. Unknown routes have a fixed fallback label. Unexpected errors return a generic 500 response rather than a raw exception; existing domain/validation HTTP responses retain their behavior.

`client_error` logs contain only a fixed operation category, error category (`http`, `unavailable`, `render`), optional 400–599 status and optional UUID correlation ID. The ingestion route rejects unknown fields and is limited to 20 reports/minute per IP. Reports are diagnostic hints from an untrusted browser, not proof that an API mutation happened. Browser reporting is capped at 10/minute, deduplicated for 10 seconds, uses no auth credentials/referrer, and times out after two seconds without delaying the user's operation. If the API itself is offline, those reports may not arrive; an independent uptime check is still needed.

Only network/5xx failures are reported automatically; normal form validation and expected auth rejections do not flood the collector. SSR failures emit a similarly limited `frontend_error` JSON record in Vercel runtime logs. The route error boundary offers a generic localized retry screen and reports a `render` event; it does not display or transmit the exception or stack. Root-layout failures outside that boundary remain a separate Next.js runtime concern.

`runtime_log`, `startup_ready` and `startup_failed` records are deliberately limited. Nest bootstrap/runtime logging does not serialize exception objects, messages or stacks that could contain connection strings or personal data. Startup configuration failures must be diagnosed against the required-variable checklist; raw secret-bearing errors are not logged.

## Operating checklist

Before beta, configure independent uptime checks for API readiness and the web homepage (for example, every 60 seconds); alert after sustained failures, not a single brief deploy transition. Monitor the count/rate of HTTP 5xx, slow core requests and client failures in Railway/Vercel log tooling. Assign an incident owner and notification destination in the chosen operations platform. No destination or external alerting account has been configured from this repository.

For an incident:

1. Record the affected operation, approximate time, full deployed commit and request ID. Never ask a user for tokens/passwords or copy their request body into an issue.
2. Find `http_request` and `client_error` records with that request ID in Railway. For server rendering failures, inspect `frontend_error` in Vercel at the same time.
3. Check `/api/health/ready`, migrations and host restart/deployment events. Compare API and web commits with `scripts/verify-release.mjs`.
4. Check dependency configuration without printing its values. Reproduce with synthetic staging data, then use the release rollback checklist if needed.
5. Verify readiness and the critical flow after recovery; record the technical cause and sanitized regression evidence.

If adding Sentry/APM later, disable automatic PII collection, bodies, request headers, query strings, localStorage and console breadcrumbs unless explicitly sanitized. Existing browser console messages are not ingested by this reporting pipeline. Use short retention and restricted operational access; choose actual retention/alert settings in the host dashboards before launch.
