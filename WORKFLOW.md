# Workflow

Updated for the repository state audited on April 10, 2026.

## Purpose

This file describes the safest default workflow for making changes in this repo.

It replaces older automation-specific instructions that no longer match the checked-in repository structure.

## Default Change Flow

1. Read [README.md](./README.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and [TESTING.md](./TESTING.md).
2. Check `git status --short`.
3. Inspect the exact feature files involved.
4. Reproduce the issue or verify the current behavior when possible.
5. Make the smallest safe change.
6. Run targeted validation for the touched surface area.
7. Update docs if commands, env vars, routes, or workflows changed.
8. Summarize what changed, what you validated, and any remaining caveats.

## Branching

The repo does not currently encode a required branch naming scheme.

Recommended approach:

- create a focused branch per task
- use an issue ID in the branch name when one exists
- avoid mixing unrelated cleanup into the same branch

## Validation Matrix

### Docs-only

```bash
git diff --stat
```

### Frontend-only

```bash
cd apps/web
npm run lint
npm run build
npm run check-types
```

If `check-types` fails with a missing `.next/types` file, run the build first and retry.

### Backend-only

```bash
cd apps/api
npm run lint
npm run check-types
npm run build
npm run test -- --watchman=false
```

Add e2e when controller wiring, guards, or bootstrap behavior changed:

```bash
cd apps/api
npm run test:e2e -- --watchman=false
```

### Cross-cutting

```bash
npm run lint
npm run build
npm run check-types
```

Remember:

- root type-check currently fails because of `packages/shared`
- root lint and root build are currently green

## CI Workflow Reality

Observed in `.github/workflows/ci.yml`:

- CI runs on `main` and `develop`
- API unit tests run
- API e2e tests run
- web build runs
- Playwright only runs when config and tests exist
- deploy jobs are placeholders

Use CI as a real validation signal, but do not treat it as a real deployment system yet.

## Deployment Workflow Reality

The repository does not currently define:

- a real production deployment branch
- a checked-in Vercel config
- a checked-in Railway config
- a checked-in infrastructure manifest

If your change affects deployment, read [DEPLOYMENT.md](./DEPLOYMENT.md) first and avoid inventing missing platform behavior.

## Completion Checklist

Before considering work complete, confirm:

- the change stayed scoped
- relevant validations ran
- docs were updated if behavior changed
- pre-existing quirks were separated from new regressions
- no repo-external deployment assumptions were added without proof
