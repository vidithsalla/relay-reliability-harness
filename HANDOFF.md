# HANDOFF

## Run Locally

```bash
cp .env.example .env.local
npm install
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000` unless Next selects another port.

## What To Inspect First

- `lib/services/run-service.ts`: execution coordinator, review flow, replay, persisted trace.
- `lib/adapters/claims-adapter.ts`: expected-version writes and idempotency ledger.
- `lib/faults/fault-injecting-adapter.ts`: deterministic failure timing.
- `lib/reconciliation/reconciliation-engine.ts`: read-back driven status classification.
- `lib/recovery/recovery-engine.ts`: retry/replan/manual-investigation decisions.
- `lib/eval/eval-suite.ts`: required 12 deterministic eval cases.

## Demo Path

Run these from `/`:

1. Timeout after write.
2. Partial completion.
3. Stale state.
4. High-risk settlement, then approve in `/review`.
5. Open `/evals`.

## Key Decisions

- Postgres is the runtime source of truth.
- Plans are proposals; policy, idempotency, expected versions, reconciliation, and recovery are server-owned.
- Action execution is sequential for clear partial-completion/version-chain evidence.
- Unknown irreversible outcomes stop for manual investigation.
- Replay creates a new run and does not overwrite history.

## Limitations

No real enterprise connector, no Guidewire compatibility claim, no the target company internal claim, prototype actor switching only, no distributed workers, no real settlements/payments, deterministic fixture planner by default, optional Grok provider depends on external credentials.
