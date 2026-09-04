# BUILD_NOTES

## Implementation Checklist

- [x] Phase 0: Scaffold a strict TypeScript Next.js App Router project with scripts, Docker Compose Postgres, Drizzle wiring, `.env.example`, and baseline README disclaimer.
- [x] Phase 1: Implement synthetic claims source-of-record schema, migrations, seeds, adapter interface, atomic expected-version writes, and idempotency ledger behavior.
- [x] Phase 2: Implement persisted runs, deterministic planner, plan validation, risk policy, server-computed idempotency keys, snapshots, trace events, and service orchestration.
- [x] Phase 3: Implement deterministic desired-effect matchers and reconciliation statuses driven by authoritative read-back, not transport status alone.
- [x] Phase 4: Implement deterministic fault profiles for before-write timeout, after-write timeout, malformed response after write, read-back timeout, external version bump, and retry exhaustion.
- [x] Phase 5: Implement recovery rules, max attempts, selective retry, terminal statuses, and version-chain progression across multi-action plans.
- [x] Phase 6: Implement high-risk settlement review, reviewer-only approval/rejection, state revalidation, and review invalidation on version changes.
- [x] Phase 7: Implement optional xAI/Grok planner provider behind the same schema, with deterministic planner as the complete local default.
- [x] Phase 8: Implement 12 deterministic eval cases through the coordinator and persist eval results.
- [x] Phase 9: Build operator-console UI for scenarios, runs, run detail intent-vs-reality, trace timeline, review queue, evals, and about page.
- [x] Phase 10: Implement seeded replay that creates a linked new run without overwriting history.
- [x] Phase 11: Add Playwright e2e coverage and browser verification for required flows and persistence after refresh.
- [x] Phase 12: Finalize README, architecture/security/demo/eval docs, `BUILD_STATUS.md`, `VERIFICATION_REPORT.md`, and `HANDOFF.md`.
- [x] Phase 13: Run and fix the full verification sequence: install, db up, migrate, seed, lint, typecheck, unit, integration, eval, build, e2e, verify db.

## Locked Implementation Decisions

- Use the synthetic claims workflow only as a provider-agnostic source-of-record testbed. No Guidewire names, compatibility claims, or the target company internal claims.
- Keep the core proof centered on `fault injection -> attempted enterprise action -> authoritative read-back -> intent-vs-observed reconciliation -> safe recovery`.
- Persist the runtime demo path in Postgres; no in-memory fallback for the primary workflow.
- Execute actions sequentially so version-chain and partial-completion evidence remain legible.
- Treat settlement as irreversible and conservative: unknown settlement outcomes go to manual investigation, not automatic retry or ordinary approval.
- Use deterministic planner fixtures and deterministic fault profiles for local demo, CI, and evals.
- Record any verification result only after the command actually runs.

## Ambiguity Resolutions

- Impeccable UI skill is requested only if available; it is not present in this environment’s skill list, so the final UI pass will be performed manually against the same UX criteria.
- The local Node version is newer than the minimum Node 20 requirement; use it unless a dependency forces a narrower runtime.
- Docker Desktop did not expose a usable daemon socket in this environment. `npm run db:up` therefore tries Docker Compose first, then falls back to a real local PostgreSQL 16.13 data directory under `.relay-pgdata` when Docker is unavailable. This preserves Postgres-backed verification without using an in-memory substitute.

## Final Product-Quality Pass

- Reworked run detail around an explicit proof chain: intended state, API result, observed state, reconciled state, and recovery decision.
- Added operator-facing decision guidance for completed, review, replan, retry-exhausted manual investigation, ambiguous manual investigation, and reviewer-rejected fail-closed runs.
- Added a human-action pipeline stage and categorized audit timeline rows so request, plan, policy, attempt, fault, adapter, read-back, reconciliation, recovery, review, and final events are visually distinct.
- Replaced raw fault-profile IDs on the launcher/detail header with operator-readable failure labels while preserving deterministic evidence and stored semantics.
- Exposed duplicate request and retry exhaustion in the launcher using existing coordinator/eval behavior, not new runtime semantics.
- Fixed a UI correctness bug found during manual browser audit: failed post-attempt read-back snapshots now render as failed read-back evidence instead of assuming a claim aggregate exists.
- Fixed a review UX bug found during manual browser audit: reviewer rejection now shows rejected human action, zero adapter attempts, and failed-closed guidance rather than the prior pending-review recovery text.
- Expanded Playwright e2e coverage from 5 to 10 tests to include timeout-before-write, duplicate no-op, retry exhaustion, ambiguous manual investigation, and reviewer rejection.
- Regenerated screenshots for ten demo-relevant screens and disabled the Next dev indicator so local screenshots remain product-focused.
