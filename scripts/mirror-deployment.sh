#!/usr/bin/env bash
# Called only for a successful push CI run on the canonical main branch.
set -euo pipefail
expected_commit="${1:?Expected tested main commit}"
if [[ ! "$expected_commit" =~ ^[a-fA-F0-9]{40}$ ]]; then
  echo 'Expected a full commit SHA' >&2
  exit 1
fi
git fetch --prune origin '+refs/heads/*:refs/remotes/origin/*'
current_main="$(git rev-parse refs/remotes/origin/main)"
if [[ "$current_main" != "$expected_commit" ]]; then
  echo 'A newer main commit exists; leave deployment unchanged until its CI succeeds.'
  exit 0
fi
if git show-ref --verify --quiet refs/remotes/origin/deployment; then
  if ! git merge-base --is-ancestor refs/remotes/origin/deployment "$expected_commit"; then
    echo 'deployment has diverged from main; refusing to overwrite it.' >&2
    exit 1
  fi
fi
# The remote also rejects concurrent divergence; never force-push this mirror.
git push origin "$expected_commit:refs/heads/deployment"
echo "deployment mirrors tested main commit $expected_commit"
