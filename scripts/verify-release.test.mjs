import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { verifyRelease } from './verify-release.mjs';

const commit = 'a'.repeat(40);
async function withHost(handler, run) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
function hostResponse(res, body, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}
test('verifies database readiness and matching API/web release commits', async () => {
  const visited = [];
  await withHost((req, res) => {
    visited.push(req.url);
    if (req.url === '/api/health/ready') hostResponse(res, { status: 'ready', checks: { database: 'up' }, commit });
    else if (req.url === '/release') hostResponse(res, { commit });
    else { res.writeHead(200); res.end('<html>Marketplace</html>'); }
  }, async url => assert.deepEqual(await verifyRelease({ apiUrl: url, webUrl: url, commit }), { commit, status: 'verified' }));
  assert.deepEqual(visited.sort(), ['/', '/api/health/ready', '/release']);
});
test('rejects a stale frontend even when its homepage returns 200', async () => {
  await withHost((req, res) => hostResponse(res, req.url === '/api/health/ready' ? { status: 'ready', checks: { database: 'up' }, commit } : { commit: 'b'.repeat(40) }),
    async url => assert.rejects(verifyRelease({ apiUrl: url, webUrl: url, commit }), /Web release commit mismatch/));
});
test('rejects unhealthy database readiness without leaking the response', async () => {
  await withHost((_req, res) => hostResponse(res, { status: 'unavailable', secret: 'private-database-password' }, 503), async url => {
    await assert.rejects(verifyRelease({ apiUrl: url, webUrl: url, commit }), error => /API readiness failed/.test(error.message) && !error.message.includes('private-database-password'));
  });
});
test('rejects false readiness despite HTTP 200', async () => {
  await withHost((_req, res) => hostResponse(res, { status: 'ready', checks: { database: 'down' }, commit }), async url => {
    await assert.rejects(verifyRelease({ apiUrl: url, webUrl: url, commit }), /API database is not ready/);
  });
});
test('bounds unreachable health checks with a deadline', async () => {
  await withHost(() => {}, async url => assert.rejects(verifyRelease({ apiUrl: url, webUrl: url, commit, timeoutMs: 40 }), /API readiness failed/));
});
test('rejects credential-bearing or insecure public URLs and malformed commits', async () => {
  for (const apiUrl of ['https://name:password@example.com', 'https://example.com?token=private', 'http://example.com', 'https://example.com#secret']) {
    await assert.rejects(verifyRelease({ apiUrl, webUrl: 'https://example.com', commit }), /Invalid API URL/);
  }
  await assert.rejects(verifyRelease({ apiUrl: 'https://example.com', webUrl: 'https://example.com', commit: 'main' }), /40-character/);
});
