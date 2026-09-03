# Relay Architecture

Relay separates probabilistic interpretation from deterministic enterprise correctness.

```text
Request -> planner -> typed plan -> policy -> execution coordinator
-> fault-injected enterprise adapter -> Postgres source of record
-> read-back -> reconciliation -> recovery -> persisted trace
```

Key modules:

- `lib/ai`: deterministic planner and optional xAI/Grok provider.
- `lib/adapters`: provider-agnostic enterprise adapter and synthetic claims implementation.
- `lib/faults`: deterministic wrapper that injects timing-specific failures.
- `lib/reconciliation`: pure desired-effect matching from intent, transport evidence, and authoritative read-back.
- `lib/recovery`: deterministic retry/replan/review/manual-investigation matrix.
- `lib/services`: orchestration, persistence, review decisions, replay, and eval execution.
- `lib/db`: Drizzle schema and Postgres client wiring.

The source-of-record mutation path uses expected claim versions and an idempotency ledger in the same transaction as each mutation. Action execution is sequential in v1 so partial completion and version-chain behavior are visible.
