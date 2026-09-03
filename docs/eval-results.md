# Eval Results

Generated from the observed `npm run eval` output on 2026-09-03.

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

The eval suite executes through application services and persists `eval_runs` plus `eval_case_results`.
