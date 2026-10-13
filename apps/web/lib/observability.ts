const OPERATIONS = ["auth", "bookings", "quotes", "requests", "providers", "messages", "notifications", "uploads", "unknown"] as const;
export type ErrorOperation = typeof OPERATIONS[number];
export interface ClientErrorReport {
  operation: ErrorOperation;
  code: "http" | "unavailable" | "render";
  status?: number;
  requestId?: string;
}
const recentReports = new Map<string, number>();
let windowStartedAt = 0;
let reportsInWindow = 0;

export function validRequestId(value: string | null | undefined): string | undefined {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value : undefined;
}

export function getErrorOperation(endpoint: string): ErrorOperation {
  const group = /^\/([^/?#]+)(?:[/?#]|$)/.exec(endpoint)?.[1];
  return OPERATIONS.includes(group as ErrorOperation) ? group as ErrorOperation : "unknown";
}

/** Only fixed categories and validated correlation IDs ever leave this module. */
export function reportClientError(report: ClientErrorReport, apiBaseUrl = ""): void {
  try {
    const payload: ClientErrorReport = {
      operation: OPERATIONS.includes(report.operation) ? report.operation : "unknown",
      code: ["http", "unavailable", "render"].includes(report.code) ? report.code : "render",
    };
    if (Number.isInteger(report.status) && report.status! >= 400 && report.status! <= 599) {
      payload.status = report.status;
    }
    const requestId = validRequestId(report.requestId);
    if (requestId) payload.requestId = requestId;

    if (typeof window === "undefined") {
      console.error(JSON.stringify({ event: "frontend_error", runtime: "server", ...payload }));
      return;
    }

    const now = Date.now();
    if (now - windowStartedAt >= 60_000) {
      windowStartedAt = now;
      reportsInWindow = 0;
      recentReports.clear();
    }
    const key = `${payload.operation}:${payload.code}:${payload.status ?? ""}`;
    const previous = recentReports.get(key);
    if (reportsInWindow >= 10 || (previous !== undefined && now - previous < 10_000)) return;
    recentReports.set(key, now);
    reportsInWindow++;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      // Deliberately bypass apiRequest: never refresh, recurse, or attach credentials.
      void fetch(`${apiBaseUrl}/api/health/client-error`, {
        method: "POST",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).catch(() => {}).finally(() => clearTimeout(timeout));
    } catch {
      clearTimeout(timeout);
    }
  } catch {
    // Observability must never change the outcome of the user's operation.
  }
}
