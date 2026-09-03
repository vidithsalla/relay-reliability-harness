# Security and Trust Boundaries

Untrusted inputs:

- natural-language requests;
- model output;
- adapter response bodies;
- transport status as a proxy for business success.

Authoritative inputs in v1:

- PostgreSQL source-of-record state;
- deterministic policy code;
- server-computed idempotency keys;
- reconciliation logic;
- recovery matrix.

Rules enforced:

- model output validates through Zod before persistence or execution;
- model cannot set idempotency keys, review decisions, expected versions, or success;
- all write actions use expected-version checks;
- review approval requires reviewer role and source-state revalidation;
- unknown potentially irreversible settlement outcomes route to manual investigation;
- trace events are append-only through application services;
- all data is synthetic.

Prototype actor limitation: the demo uses seeded actors `operator` and `reviewer`; this is not production identity/auth.
