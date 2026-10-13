import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./mirror-deployment.sh', import.meta.url));
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'armut-mirror-test-'));
  const remote = join(root, 'remote.git');
  const work = join(root, 'work');
  const git = (...args) => execFileSync('git', args, { cwd: work, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    execFileSync('git', ['init', '--bare', '--initial-branch=main', remote], { stdio: 'pipe' });
    execFileSync('git', ['clone', remote, work], { stdio: 'pipe' });
    git('config', 'user.email', 'fixture@example.invalid');
    git('config', 'user.name', 'Release fixture');
    writeFileSync(join(work, 'file'), 'first');
    git('add', 'file'); git('commit', '-m', 'first'); git('push', 'origin', 'main');
    const first = git('rev-parse', 'HEAD');
    const commit = text => { writeFileSync(join(work, 'file'), text); git('add', 'file'); git('commit', '-m', text); return git('rev-parse', 'HEAD'); };
    run({ git, first, commit, mirror: sha => execFileSync('bash', [script, sha], { cwd: work, encoding: 'utf8', stdio: 'pipe' }) });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test('fast-forwards deployment to exactly the tested current main', () => fixture(({ git, first, commit, mirror }) => {
  git('push', 'origin', `${first}:refs/heads/deployment`);
  const next = commit('next'); git('push', 'origin', 'main');
  mirror(next);
  assert.equal(git('ls-remote', 'origin', 'refs/heads/deployment').split(/\s/)[0], next);
}));
test('leaves deployment unchanged when a newer untested main exists', () => fixture(({ git, first, commit, mirror }) => {
  git('push', 'origin', `${first}:refs/heads/deployment`);
  commit('newer'); git('push', 'origin', 'main');
  mirror(first);
  assert.equal(git('ls-remote', 'origin', 'refs/heads/deployment').split(/\s/)[0], first);
}));
test('refuses divergent deployment history without overwriting it', () => fixture(({ git, first, commit, mirror }) => {
  const next = commit('main-next'); git('push', 'origin', 'main');
  git('checkout', '-b', 'deployment', first);
  const divergent = commit('deployment-only'); git('push', 'origin', 'deployment');
  assert.throws(() => mirror(next), /refusing to overwrite/);
  assert.equal(git('ls-remote', 'origin', 'refs/heads/deployment').split(/\s/)[0], divergent);
}));
test('creates a missing compatibility mirror from tested main only', () => fixture(({ git, first, mirror }) => {
  mirror(first);
  assert.equal(git('ls-remote', 'origin', 'refs/heads/deployment').split(/\s/)[0], first);
}));
test('rejects malformed tested commits before running git mutations', () => fixture(({ git, mirror }) => {
  assert.throws(() => mirror('main; echo unsafe'), /full commit SHA/);
  assert.equal(git('ls-remote', 'origin', 'refs/heads/deployment'), '');
}));
