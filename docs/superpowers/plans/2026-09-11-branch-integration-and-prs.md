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

- [ ] Resolve documentation conflicts against current `origin/main`.
- [ ] Align all branch guidance with the decision to retain `deployment` as a mirror.
- [ ] Run formatting, diff, lint, type-check, build, and unit-test validation.
- [ ] Commit and push `codex/planning-docs-refresh`.
- [ ] Open a pull request targeting `main` and request review.

## Task 2: Reconcile and publish the payment branch

- [ ] Create an isolated worktree for `codex/stripe-connect-payments`.
- [ ] Fast-forward the local branch to `origin/codex/stripe-connect-payments`.
- [ ] Establish a passing branch baseline, then merge current `origin/main` without rebasing published commits.
- [ ] Run root lint, type-check, build, unit tests, and all available payment-sensitive checks.
- [ ] Review the combined diff and document known release blockers.
- [ ] Push the synchronized branch and open a draft pull request targeting `main`.

## Task 3: Synchronize the deployment compatibility branch

- [ ] Create an isolated worktree for `deployment`.
- [ ] Fast-forward `deployment` to current `origin/main`.
- [ ] Push without adding feature-only commits.
- [ ] Confirm local and remote deployment tips match current `main`.
- [ ] Repeat the fast-forward after approved pull requests merge into `main`.

## Task 4: Final audit and handoff

- [ ] Confirm both pull requests target `main` and report their review/release caveats.
- [ ] Confirm no stale mobile prototype branch was merged or deleted.
- [ ] Report validation evidence, e2e limitations, and the required post-merge deployment sync.
