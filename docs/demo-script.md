# 90-Second Demo Script

0-12 seconds:

> I built the layer between an AI agent deciding to take an enterprise action and us being able to trust that the action actually happened correctly.

12-30 seconds:

Run **Timeout after write**. Show that reserve update committed, the adapter timed out, Relay read authoritative state back, reconciled the mutation as `CONFIRMED_APPLIED`, and did not retry.

30-50 seconds:

Run **Partial completion**. Show reserve has one attempt and inspection has two attempts. Relay retries only the missing action.

50-68 seconds:

Run **Stale state**. Show expected version 18 versus observed version 19 and `REPLAN_REQUIRED`.

68-82 seconds:

Run **High-risk settlement**. Open `/review`, approve, and show server revalidation before execution.

82-90 seconds:

Open `/evals` and cite the actual persisted result.

> The model proposes intent. The system of record determines truth.
