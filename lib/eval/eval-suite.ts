import { pool } from "@/lib/db/client";
import { resetClaimFixtures, bumpClaimVersion } from "@/lib/services/seed-service";
import { createAndStartRun, decideReview, getRunDetail } from "@/lib/services/run-service";

export type EvalCaseResult = {
  caseId: string;
  label: string;
  passed: boolean;
  runId: string | null;
  assertions: Array<{ name: string; passed: boolean; actual?: unknown }>;
  failureSummary: string | null;
  durationMs: number;
};

type EvalCase = {
  id: string;
  label: string;
  run: () => Promise<EvalCaseResult>;
};

export const evalCases: EvalCase[] = [
  makeCase("E01_HAPPY_PATH", "happy_path", async () => {
    await resetClaimFixtures(["CLM-1042"]);
    const run = await createAndStartRun(baseRepairRun("none"));
    const detail = await mustDetail(run.runId);
    return assertCase("E01_HAPPY_PATH", "happy_path", run.runId, [
      ["run completed", detail.run.status === "COMPLETED", detail.run.status],
      ["reserve 840000", detail.finalClaim?.reserveAmountCents === 840000, detail.finalClaim?.reserveAmountCents],
      ["exactly one inspection", detail.finalClaim?.inspections.length === 1, detail.finalClaim?.inspections.length],
      ["0 retries", detail.attempts.length === 2, detail.attempts.length],
      [
        "all confirmed applied",
        detail.reconciliations.every((row: { status: string }) => row.status === "CONFIRMED_APPLIED"),
        detail.reconciliations.map((row: { status: string }) => row.status)
      ]
    ]);
  }),
  makeCase("E02_TIMEOUT_BEFORE_WRITE", "timeout_before_write", async () => {
    await resetClaimFixtures(["CLM-1042"]);
    const run = await createAndStartRun(baseRepairRun("timeout-before-write-reserve"));
    const detail = await mustDetail(run.runId);
    return assertCase("E02_TIMEOUT_BEFORE_WRITE", "timeout_before_write", run.runId, [
      ["run completed", detail.run.status === "COMPLETED", detail.run.status],
      ["first reconciliation not applied", detail.reconciliations[0]?.status === "CONFIRMED_NOT_APPLIED", detail.reconciliations[0]?.status],
      ["one retry", attemptsByOrdinal(detail, 1) === 2, attemptsByOrdinal(detail, 1)],
      ["reserve correct once", detail.finalClaim?.reserveAmountCents === 840000, detail.finalClaim?.reserveAmountCents]
    ]);
  }),
  makeCase("E03_TIMEOUT_AFTER_WRITE", "timeout_after_write", async () => {
    await resetClaimFixtures(["CLM-1042"]);
    const run = await createAndStartRun(baseRepairRun("timeout-after-write-reserve"));
    const detail = await mustDetail(run.runId);
    return assertCase("E03_TIMEOUT_AFTER_WRITE", "timeout_after_write", run.runId, [
      ["transport timeout", detail.attempts[0]?.transport_status === "TIMEOUT", detail.attempts[0]?.transport_status],
      ["confirmed applied", detail.reconciliations[0]?.status === "CONFIRMED_APPLIED", detail.reconciliations[0]?.status],
      ["no retry action 1", attemptsByOrdinal(detail, 1) === 1, attemptsByOrdinal(detail, 1)]
    ]);
  }),
  makeCase("E04_PARTIAL_COMPLETION", "partial_completion", async () => {
    await resetClaimFixtures(["CLM-1042"]);
    const run = await createAndStartRun(baseRepairRun("partial-reserve-success-inspection-timeout-before"));
    const detail = await mustDetail(run.runId);
    return assertCase("E04_PARTIAL_COMPLETION", "partial_completion", run.runId, [
      ["run completed", detail.run.status === "COMPLETED", detail.run.status],
      ["reserve one attempt", attemptsByOrdinal(detail, 1) === 1, attemptsByOrdinal(detail, 1)],
      ["inspection two attempts", attemptsByOrdinal(detail, 2) === 2, attemptsByOrdinal(detail, 2)],
      ["one inspection created", detail.finalClaim?.inspections.length === 1, detail.finalClaim?.inspections.length]
    ]);
  }),
  makeCase("E05_STALE_VERSION", "stale_version", async () => {
    await resetClaimFixtures(["CLM-1042"]);
    const run = await createAndStartRun(baseRepairRun("stale-version-before-second-action"));
    const detail = await mustDetail(run.runId);
    return assertCase("E05_STALE_VERSION", "stale_version", run.runId, [
      ["run replan", detail.run.status === "REPLAN_REQUIRED", detail.run.status],
      ["no inspection", detail.finalClaim?.inspections.length === 0, detail.finalClaim?.inspections.length],
      [
        "conflict recorded",
        detail.reconciliations.some((row: { status: string }) => row.status === "CONFLICTED"),
        detail.reconciliations.map((row: { status: string }) => row.status)
      ]
    ]);
  }),
  makeCase("E06_DUPLICATE_SEMANTIC_REQUEST", "duplicate_semantic_request", async () => {
    await resetClaimFixtures(["CLM-1042"]);
    await createAndStartRun({ ...baseRepairRun("none"), logicalRunNamespace: "E06_DUPLICATE" });
    const run = await createAndStartRun({ ...baseRepairRun("none"), logicalRunNamespace: "E06_DUPLICATE" });
    const detail = await mustDetail(run.runId);
    return assertCase("E06_DUPLICATE_SEMANTIC_REQUEST", "duplicate_semantic_request", run.runId, [
      ["run completed", detail.run.status === "COMPLETED", detail.run.status],
      [
        "no-op duplicate seen",
        detail.reconciliations.some((row: { status: string }) => row.status === "NO_OP_DUPLICATE"),
        detail.reconciliations.map((row: { status: string }) => row.status)
      ],
      ["one inspection total", detail.finalClaim?.inspections.length === 1, detail.finalClaim?.inspections.length]
    ]);
  }),
  makeCase("E07_HIGH_RISK_REVIEW", "high_risk_review", async () => {
    await resetClaimFixtures(["CLM-2048"]);
    const run = await createAndStartRun(settlementRun("Issue the agreed $42,500 settlement.", "none"));
    let detail = await mustDetail(run.runId);
    const review = detail.reviews[0];
    const beforeCount = detail.finalClaim?.settlements.length ?? -1;
    await decideReview({ reviewId: review.id, decision: "APPROVE", note: "Within authority.", actorId: "reviewer" });
    detail = await mustDetail(run.runId);
    return assertCase("E07_HIGH_RISK_REVIEW", "high_risk_review", run.runId, [
      ["waiting review before approval", run.status === "WAITING_REVIEW", run.status],
      ["no settlement before approval", beforeCount === 0, beforeCount],
      ["run completed after approval", detail.run.status === "COMPLETED", detail.run.status],
      ["one settlement", detail.finalClaim?.settlements.length === 1, detail.finalClaim?.settlements.length]
    ]);
  }),
  makeCase("E08_REVIEW_INVALIDATED", "review_invalidated", async () => {
    await resetClaimFixtures(["CLM-2048"]);
    const run = await createAndStartRun(settlementRun("Issue the agreed $42,500 settlement.", "none"));
    const detail = await mustDetail(run.runId);
    await bumpClaimVersion("CLM-2048");
    await decideReview({ reviewId: detail.reviews[0].id, decision: "APPROVE", actorId: "reviewer" });
    const after = await mustDetail(run.runId);
    return assertCase("E08_REVIEW_INVALIDATED", "review_invalidated", run.runId, [
      ["run replan", after.run.status === "REPLAN_REQUIRED", after.run.status],
      ["review invalidated", after.reviews[0]?.status === "INVALIDATED", after.reviews[0]?.status],
      ["no settlement", after.finalClaim?.settlements.length === 0, after.finalClaim?.settlements.length]
    ]);
  }),
  makeCase("E09_MALFORMED_RESPONSE_AFTER_WRITE", "malformed_response_after_write", async () => {
    await resetClaimFixtures(["CLM-1042"]);
    const run = await createAndStartRun(baseRepairRun("malformed-response-after-write-reserve"));
    const detail = await mustDetail(run.runId);
    return assertCase("E09_MALFORMED_RESPONSE_AFTER_WRITE", "malformed_response_after_write", run.runId, [
      ["malformed transport", detail.attempts[0]?.transport_status === "MALFORMED_RESPONSE", detail.attempts[0]?.transport_status],
      ["confirmed applied", detail.reconciliations[0]?.status === "CONFIRMED_APPLIED", detail.reconciliations[0]?.status],
      ["no retry", attemptsByOrdinal(detail, 1) === 1, attemptsByOrdinal(detail, 1)]
    ]);
  }),
  makeCase("E10_AMBIGUOUS_WRITE_AND_READBACK_FAILURE", "ambiguous_write_and_readback_failure", async () => {
    await resetClaimFixtures(["CLM-2048"]);
    const run = await createAndStartRun(settlementRun("Issue the agreed $9,500 settlement.", "ambiguous-write-and-readback-timeout"));
    const detail = await mustDetail(run.runId);
    return assertCase("E10_AMBIGUOUS_WRITE_AND_READBACK_FAILURE", "ambiguous_write_and_readback_failure", run.runId, [
      ["manual investigation", detail.run.status === "MANUAL_INVESTIGATION", detail.run.status],
      ["unknown reconciliation", detail.reconciliations[0]?.status === "UNKNOWN", detail.reconciliations[0]?.status],
      ["no retry", detail.attempts.length === 1, detail.attempts.length]
    ]);
  }),
  makeCase("E11_RETRY_EXHAUSTION", "retry_exhaustion", async () => {
    await resetClaimFixtures(["CLM-1042"]);
    const run = await createAndStartRun({
      claimId: "CLM-1042",
      requestText: "Schedule another inspection.",
      plannerMode: "deterministic",
      faultProfileId: "retry-exhaustion-inspection",
      scenarioId: "eval-retry-exhaustion"
    });
    const detail = await mustDetail(run.runId);
    return assertCase("E11_RETRY_EXHAUSTION", "retry_exhaustion", run.runId, [
      ["manual investigation", detail.run.status === "MANUAL_INVESTIGATION", detail.run.status],
      ["no inspection", detail.finalClaim?.inspections.length === 0, detail.finalClaim?.inspections.length],
      ["three attempts", detail.attempts.length === 3, detail.attempts.length]
    ]);
  }),
  makeCase("E12_ILLEGAL_TRANSITION", "illegal_transition", async () => {
    await resetClaimFixtures(["CLM-3001"]);
    const run = await createAndStartRun({
      claimId: "CLM-3001",
      requestText: "Schedule another inspection.",
      plannerMode: "deterministic",
      faultProfileId: "none",
      scenarioId: "eval-illegal-transition"
    });
    const detail = await mustDetail(run.runId);
    return assertCase("E12_ILLEGAL_TRANSITION", "illegal_transition", run.runId, [
      ["failed closed", detail.run.status === "FAILED_CLOSED", detail.run.status],
      ["blocked action", detail.actions[0]?.status === "BLOCKED_PRECONDITION", detail.actions[0]?.status],
      ["adapter never called", detail.attempts.length === 0, detail.attempts.length]
    ]);
  })
];

export async function runEvalSuite(): Promise<{ evalRunId: string; results: EvalCaseResult[]; passed: number; failed: number }> {
  const evalRun = await pool.query<{ id: string }>(
    "INSERT INTO eval_runs (suite_version, git_sha, total_cases) VALUES ('relay-v1', $1, $2) RETURNING id",
    [process.env.GIT_SHA ?? null, evalCases.length]
  );
  const evalRunId = evalRun.rows[0].id;
  const results: EvalCaseResult[] = [];
  for (const evalCase of evalCases) {
    const result = await evalCase.run();
    results.push(result);
    await pool.query(
      `
        INSERT INTO eval_case_results (
          eval_run_id, case_id, run_id, passed, assertions_json, failure_summary, duration_ms
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        evalRunId,
        result.caseId,
        result.runId,
        result.passed,
        JSON.stringify(result.assertions),
        result.failureSummary,
        result.durationMs
      ]
    );
  }
  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  await pool.query(
    "UPDATE eval_runs SET completed_at = now(), passed_cases = $1, failed_cases = $2 WHERE id = $3",
    [passed, failed, evalRunId]
  );
  return { evalRunId, results, passed, failed };
}

export async function latestEvalRun() {
  const run = (await pool.query("SELECT * FROM eval_runs ORDER BY started_at DESC LIMIT 1")).rows[0] ?? null;
  if (!run) return null;
  const cases = (await pool.query("SELECT * FROM eval_case_results WHERE eval_run_id = $1 ORDER BY case_id", [run.id])).rows;
  return { run, cases };
}

function makeCase(id: string, label: string, run: () => Promise<EvalCaseResult>): EvalCase {
  return { id, label, run };
}

function baseRepairRun(faultProfileId: string) {
  return {
    claimId: "CLM-1042",
    requestText:
      "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
    plannerMode: "deterministic" as const,
    faultProfileId,
    scenarioId: `eval-${faultProfileId}`
  };
}

function settlementRun(requestText: string, faultProfileId: string) {
  return {
    claimId: "CLM-2048",
    requestText,
    plannerMode: "deterministic" as const,
    faultProfileId,
    scenarioId: `eval-${faultProfileId}`
  };
}

async function mustDetail(runId: string) {
  const detail = await getRunDetail(runId);
  if (!detail) throw new Error(`Run ${runId} was not persisted`);
  return detail;
}

type DetailForAttempts = {
  actions: Array<{ id: string; ordinal: number }>;
  attempts: Array<{ planned_action_id: string }>;
};

function attemptsByOrdinal(detail: DetailForAttempts, ordinal: number): number {
  const action = detail.actions.find((item) => item.ordinal === ordinal);
  if (!action) return 0;
  return detail.attempts.filter((attempt) => attempt.planned_action_id === action.id).length;
}

function assertCase(
  caseId: string,
  label: string,
  runId: string,
  assertions: Array<[string, boolean, unknown?]>
): EvalCaseResult {
  const formatted = assertions.map(([name, passed, actual]) => ({ name, passed, actual }));
  const failed = formatted.filter((assertion) => !assertion.passed);
  return {
    caseId,
    label,
    passed: failed.length === 0,
    runId,
    assertions: formatted,
    failureSummary: failed.length ? failed.map((assertion) => assertion.name).join("; ") : null,
    durationMs: 0
  };
}
