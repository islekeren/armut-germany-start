# Branch Integration and PR Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile active branches around canonical `main`, publish the documentation refresh and Stripe payment work as reviewable pull requests, and keep `deployment` as a synchronized compatibility mirror.

**Architecture:** `main` remains the only integration and release source. Feature branches merge into `main` through reviewed pull requests; `deployment` receives no direct feature commits and is fast-forwarded only from `main`.

**Tech Stack:** Git, GitHub pull requests, npm workspaces, Turborepo, NestJS, Next.js, Prisma, Stripe Connect

**Spec:** `docs/IMPLEMENTATION_ROADMAP.md`

## Global Constraints

- Preserve unrelated user changes and do not rewrite published history.
- Use merge or fast-forward operations; do not force-push.
- Do not merge the stale mobile prototype branches into `main`.
- Treat payment, schema, booking, quote, auth, and deployment changes as high risk.
- Do not represent placeholder CI deploy jobs as a real production release.

---

## Task 1: Publish the documentation refresh

- [x] Resolve documentation conflicts against current `origin/main`.
- [x] Align all branch guidance with the decision to retain `deployment` as a mirror.
- [x] Run formatting, diff, lint, type-check, build, and unit-test validation.
- [x] Commit and push `codex/planning-docs-refresh`.
- [x] Open pull request [#7](https://github.com/islekeren/armut-germany-start/pull/7) targeting `main` and complete independent review.

## Task 2: Reconcile and publish the payment branch

- [x] Create an isolated worktree for `codex/stripe-connect-payments`.
- [x] Fast-forward the local branch to `origin/codex/stripe-connect-payments`.
- [x] Establish a passing branch baseline, then merge current `origin/main` without rebasing published commits.
- [x] Run root lint, type-check, build, unit tests, API e2e, and Playwright on clean test data.
- [x] Review the combined diff and document known release blockers.
- [x] Push the synchronized branch and open draft pull request [#8](https://github.com/islekeren/armut-germany-start/pull/8) targeting `main`.

## Task 3: Synchronize the deployment compatibility branch

- [x] Create an isolated worktree for `deployment`.
- [x] Fast-forward `deployment` to current `origin/main`.
- [x] Push without adding feature-only commits.
- [x] Confirm local and remote deployment tips match current `main`.
- [ ] Repeat the fast-forward after approved pull requests merge into `main`.

## Task 4: Final audit and handoff

- [x] Confirm both pull requests target `main` and report their review/release caveats.
- [x] Confirm no stale mobile prototype branch was merged or deleted.
- [ ] Report validation evidence, e2e limitations, and the required post-merge deployment sync.
