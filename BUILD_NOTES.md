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
- The onboarding request requires “AI/model” language on the explanatory homepage, but the run detail must stay planner-neutral. Homepage copy therefore explains the general AI boundary, while run detail says “The planner proposed intent.”

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

## Onboarding and First-Impression Pass

- Added a dedicated explanatory homepage at `/` focused on the timeout-after-write proof: intended reserve change, API timeout, authoritative observed state, reconciliation, and no duplicate retry.
- Moved the existing scenario launcher to `/scenarios` without changing scenario definitions, runtime state machines, database schema, eval expectations, recovery semantics, or run-detail behavior.
- Updated primary navigation so the Relay logo returns to `/` and the Scenarios link opens `/scenarios`.
- Added homepage sections for the 15-second problem, Relay lifecycle, broader failure modes, product definition/disclaimer, AI/Relay/system-of-record trust boundary, and “Break it yourself” scenario entry.
- Updated run-detail copy from “The model proposed intent.” to “The planner proposed intent.” while leaving the homepage’s general AI framing intact.
- Added Playwright coverage for homepage comprehension, home-to-scenarios CTA routing, nav separation, scenario launch from `/scenarios`, and the planner-neutral run-detail phrase.
- Regenerated screenshots for 11 demo-relevant screens, including the new homepage as `docs/screenshots/00-homepage.png`.
- Manually checked the homepage at desktop and mobile widths; mobile has no horizontal overflow and interactive targets meet the 44px baseline.

## Homepage Simplification Pass

- Reduced `/` from a long explanatory page to four sections: hero, one timeout example, general recovery rule, and try-it entry points.
- Removed the hero proof card, the three-panel “problem in 15 seconds” layout, the five-step lifecycle, repeated proof grid, broad failure explanation section, “What Relay is” definition, and AI/Relay/enterprise trust-boundary diagram from the homepage.
- Re-homed the detailed product definition, reliability feature list, deterministic failure/reconciliation/idempotency/version-check terminology, planner boundary, optional xAI/Grok explanation, and architecture flow to `/about`.
- Changed the homepage primary CTA to a direct demo form that reuses the existing `timeout-after-write` scenario through `runScenarioAction`; no new runtime path or scenario behavior was added.
- Kept `/scenarios` unchanged as the full scenario launcher and retained the small synthetic-claims disclosure at the bottom of `/`.
- Added e2e coverage for the direct homepage demo CTA while preserving scenario, review, eval, and run-detail coverage.

## Homepage Concrete Story Pass

- Rewrote `/` around one concrete failure story: claim reserve change, API timeout, actual reserve already updated, Relay decides not to retry.
- Replaced abstract homepage terms such as “enterprise systems,” “safe next step,” and “authoritative evidence” with direct language about what happened, the actual system, and not repeating a successful action.
- Kept the primary CTA wired to the existing `timeout-after-write` scenario through `runScenarioAction`.
- Updated the general outcomes to: already happened/don’t do it again, definitely didn’t happen/retry safely, and can’t prove either/stop and investigate.
- Preserved the four-section homepage structure, `/scenarios` behavior, run detail behavior, reliability engine, database semantics, and eval expectations.

## Final Homepage Communication Pass

- Removed the giant standalone `Relay` homepage title so the page starts directly with the failure question; Relay remains in the persistent nav/logo.
- Replaced the three-outcome abstraction with a plain-language `How it works` sequence: action intent, enterprise call, real state check, intent-vs-reality comparison, and safe next step.
- Changed the primary CTA to **See how Relay handles failures**, still using the existing `timeout-after-write` scenario through `runScenarioAction`.
- Kept exactly four homepage sections: hero, example, how it works, and try the failure modes.
- Left backend behavior, scenario logic, routes, reconciliation, retry logic, evals, database behavior, run-detail pages, and product semantics unchanged.

## Homepage Structural Redesign Pass

- Built a temporary `/design-lab` route with three structural variants before changing `/`: causal execution rail, before/with Relay comparison, and execution gap.
- Selected Variant C, execution gap, because it made Relay's role spatially obvious: it sits between a timed-out enterprise call, an uncertainty checkpoint, the actual-state check, and the retry decision.
- Rejected Variant A because the rail communicated causality well but still read as a linear process, making Relay less visibly positioned between uncertainty and the next action.
- Rejected Variant B because the before/with comparison made the value proposition obvious, but it looked closer to an editorial comparison and de-emphasized the concrete reserve evidence.
- Consolidated the homepage to four sections: hero, one integrated `How Relay works` explainer, one short bridge to broader failure modes, and `Try the failure modes`.
- Removed the temporary `/design-lab` route and unused variant styles after promoting the selected structure.
- Preserved backend behavior, runtime semantics, scenario definitions, run pages, reconciliation, recovery logic, database behavior, tests, and eval expectations.

## Final Homepage Information Hierarchy Pass

- Reordered `/` around progressive disclosure: hero problem, `How Relay works`, compact proof gateway, restrained `Under the hood`, and `Try the failure modes`.
- Changed the hero CTA to jump to the proof gateway instead of launching immediately, so a first-time reviewer sees the explanation before choosing demo, trace, or eval evidence.
- Added three proof gateway entries using existing routes and server actions only: `Run a failure` submits `timeout-after-write`, `Inspect a trace` opens `/runs`, and `View the evals` opens `/evals`.
- Added four restrained `Under the hood` items for failure injection, reconciliation + recovery, execution safety, and verification, including the statement that the planner proposes intent while deterministic software owns execution safety.
- Preserved the uncertainty-gap explainer and only tightened surrounding hierarchy; no backend behavior, routes, scenario semantics, reconciliation, recovery, database logic, eval definitions, or run-detail functionality changed.
