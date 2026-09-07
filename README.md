# Relay

Relay is a production-shaped reliability harness for agent actions against mutable business systems. It injects failures around a synthetic source-of-record adapter, reads state back after attempted mutations, reconciles intended versus observed effects, and decides whether to complete, retry safely, replan, route to human review, or stop for manual investigation.

The included claims workflow is synthetic and provider-agnostic. It is not a real insurer integration, not a Guidewire integration, and not affiliated with or based on any third-party company's internal architecture. This repository is proof-of-work quality, not production-ready software.

**Live demo:** [Open Relay](https://relay-reliability-harness.vercel.app) · **Screenshots:** `docs/screenshots`

## What It Proves

Relay keeps five facts separate:

- model proposal: typed intent, never authorization or truth;
- policy: deterministic pre-execution constraints;
- transport result: success, timeout, malformed response, conflict, or transient error;
- authoritative read-back: persisted source-of-record state after the attempt;
- recovery: deterministic decision from reconciliation evidence.

Core proof:

```text
fault injection -> attempted enterprise action -> authoritative read-back
-> intent-vs-observed reconciliation -> safe recovery
```

## Architecture

```text
Natural-language request
  -> PlannerProvider (deterministic | optional Grok)
  -> typed ActionPlan
  -> PlanValidator + RiskPolicy
  -> ExecutionCoordinator
  -> FaultInjectingAdapter
  -> Synthetic ClaimsEnterpriseAdapter
  -> PostgreSQL source of record
  -> post-action read-back
  -> ReconciliationEngine
  -> RecoveryEngine
  -> persisted trace / review / eval evidence
```

## Fault Matrix

| Fault | Expected behavior |
| --- | --- |
| No fault | Read-back confirms all effects and run completes. |
| Timeout before write | Read-back proves effect absent; retry allowed for safe action. |
| Timeout after write | Mutation commits, transport times out, read-back confirms applied; no retry. |
| Partial completion | Completed action remains complete; only missing action retries. |
| External version bump | Expected-version conflict blocks mutation and requires replan. |
| Malformed response after write | Response is bad, but read-back confirms business truth. |
| Read-back timeout after ambiguous write | Outcome is `UNKNOWN`; potentially irreversible mutation goes to manual investigation. |
| Retry exhaustion | Safe retries stop at configured max attempts and fail closed/manual investigation. |

## Verified Eval Evidence

Latest observed local eval output:

```text
E01_HAPPY_PATH                             PASS
E02_TIMEOUT_BEFORE_WRITE                   PASS
E03_TIMEOUT_AFTER_WRITE                    PASS
E04_PARTIAL_COMPLETION                     PASS
E05_STALE_VERSION                          PASS
E06_DUPLICATE_SEMANTIC_REQUEST             PASS
E07_HIGH_RISK_REVIEW                       PASS
E08_REVIEW_INVALIDATED                     PASS
E09_MALFORMED_RESPONSE_AFTER_WRITE         PASS
E10_AMBIGUOUS_WRITE_AND_READBACK_FAILURE   PASS
E11_RETRY_EXHAUSTION                       PASS
E12_ILLEGAL_TRANSITION                     PASS
12/12 passed
```

## Screenshots

- [Homepage](docs/screenshots/00-homepage.png)
- [Scenario launcher](docs/screenshots/01-scenario-launcher.png)
- [Timeout after write](docs/screenshots/02-timeout-after-write.png)
- [Timeout before write](docs/screenshots/03-timeout-before-write.png)
- [Partial completion](docs/screenshots/04-partial-completion.png)
- [Stale version](docs/screenshots/05-stale-version.png)
- [Duplicate request](docs/screenshots/06-duplicate-request.png)
- [Retry exhaustion](docs/screenshots/07-retry-exhaustion.png)
- [Ambiguous investigation](docs/screenshots/08-ambiguous-investigation.png)
- [Review Queue](docs/screenshots/09-review-queue.png)
- [Reliability evals](docs/screenshots/10-eval-results.png)

## Setup

```bash
cp .env.example .env.local
npm install
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run db:up` tries Docker Compose first. In this environment Docker Engine was unavailable, so the script also supports a real local PostgreSQL 16 fallback under `.relay-pgdata`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run eval
npm run build
npm run test:e2e
npm run verify:db
```

## 90-Second Demo

1. Open `/` and explain: an AI agent changes a claim reserve, the API times out, and nobody knows yet whether the change failed or only the response was lost.
2. Click **See how Relay handles failures** to jump to the proof gateway, then click **Run a failure**.
3. On the execution trace, show: action attempted, API timed out, read-back shows reserve changed, reconciliation is `CONFIRMED_APPLIED`, and no retry occurred.
4. Run **Partial completion** and show reserve has one attempt while inspection has two.
5. Run **Stale state** and show expected-version conflict leading to `REPLAN_REQUIRED`.
6. Run **High-risk settlement**, approve it in Review Queue (`/review`), and show revalidation before settlement execution.
7. Open `/evals` and report only the actual persisted eval count.

## Limitations

- synthetic claims system, not a real enterprise integration;
- no Guidewire API or schema compatibility claim;
- no third-party internal architecture claim;
- narrow four-action catalog;
- sequential action execution only;
- deterministic recovery rules, not learned recovery;
- prototype/demo actors, not production auth;
- no distributed queue/workers;
- no cross-service distributed transactions;
- no real payment/settlement side effects;
- fault injection approximates failure semantics in-process around a local adapter;
- deterministic planner is fixture-driven;
- Grok planner requires external xAI credentials and was not live-smoked without a key;
- app-level trace events, not full production telemetry.
- anonymous hosted demos isolate synthetic claim state per visitor, but this is still demo isolation rather than enterprise authentication.
