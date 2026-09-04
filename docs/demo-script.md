# 90-Second Demo Script

0-12 seconds:

Open `/`.

> AI agents can act on enterprise systems. Relay verifies what actually happened before anything retries.

12-30 seconds:

Click **See it fail**. Show that reserve update committed, the adapter timed out, Relay read authoritative state back, reconciled the mutation as `CONFIRMED_APPLIED`, and did not retry.

30-50 seconds:

Run **Partial completion**. Show reserve has one attempt and inspection has two attempts. Relay retries only the missing action.

50-68 seconds:

Run **Stale state**. Show expected version 18 versus observed version 19 and `REPLAN_REQUIRED`.

68-82 seconds:

Run **High-risk settlement**. Open `/review`, approve, and show server revalidation before execution.

82-90 seconds:

Open `/evals` and cite the actual persisted result.

> The planner proposes intent. The system of record determines truth.
