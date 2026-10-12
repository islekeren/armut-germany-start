export const dynamic = "force-dynamic";

/** Public release identity only; no environment values beyond a commit SHA. */
export function GET() {
  const candidate = process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_COMMIT_SHA;
  const commit = candidate && /^[a-f0-9]{40}$/i.test(candidate) ? candidate : "unknown";
  return Response.json({ commit }, { headers: { "Cache-Control": "no-store" } });
}
