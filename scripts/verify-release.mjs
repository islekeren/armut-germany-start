import { pathToFileURL } from 'node:url';

function origin(value, label) {
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error();
    return url.origin;
  } catch { throw new Error(`Invalid ${label} URL; use an HTTPS origin without credentials, paths or query parameters`); }
}
async function read(url, label, timeoutMs, json = true) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error', cache: 'no-store' });
    if (!response.ok) throw new Error();
    return json ? await response.json() : null;
  } catch { throw new Error(`${label} failed; inspect host logs and configuration`); }
}
/** Checks the two running releases, never publishes or applies migrations. */
export async function verifyRelease({ apiUrl, webUrl, commit, timeoutMs = 10000 }) {
  if (!/^[a-f0-9]{40}$/i.test(commit || '')) throw new Error('Expected a 40-character commit SHA');
  const api = origin(apiUrl, 'API');
  const web = origin(webUrl, 'web');
  const readiness = await read(`${api}/api/health/ready`, 'API readiness', timeoutMs);
  if (readiness.status !== 'ready' || readiness.checks?.database !== 'up') throw new Error('API database is not ready');
  if (readiness.commit !== commit) throw new Error('API release commit mismatch');
  const release = await read(`${web}/release`, 'Web release metadata', timeoutMs);
  if (release.commit !== commit) throw new Error('Web release commit mismatch');
  await read(`${web}/`, 'Web homepage', timeoutMs, false);
  return { commit, status: 'verified' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [commit, apiUrl, webUrl] = process.argv.slice(2);
  try { console.log(JSON.stringify(await verifyRelease({ commit, apiUrl, webUrl }))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
