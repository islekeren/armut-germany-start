# `@repo/eslint-config`

Internal ESLint configuration package for this monorepo.

## Exports

- `@repo/eslint-config/base`
- `@repo/eslint-config/next-js`
- `@repo/eslint-config/react-internal`

## Current Usage

Observed during the April 10, 2026 audit:

- `apps/web` uses the shared config
- `apps/api` uses the shared config
- `packages/shared` uses the shared config
- `packages/ui` uses the shared config

If lint rules change here, expect repo-wide impact.
