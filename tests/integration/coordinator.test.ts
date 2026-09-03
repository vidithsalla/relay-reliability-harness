import { beforeEach, describe, expect, it } from "vitest";

import { runEvalSuite } from "@/lib/eval/eval-suite";
import { resetClaimFixtures, bumpClaimVersion } from "@/lib/services/seed-service";
import { createAndStartRun, decideReview, getRunDetail } from "@/lib/services/run-service";

describe("execution coordinator", () => {
  beforeEach(async () => {
    await resetClaimFixtures(["CLM-1042", "CLM-2048", "CLM-3001"]);
  });

  it("distinguishes timeout after write from failed business effect", async () => {
    const run = await createAndStartRun({
      claimId: "CLM-1042",
      requestText:
        "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
      plannerMode: "deterministic",
      faultProfileId: "timeout-after-write-reserve",
      scenarioId: "it-timeout-after"
    });
    const detail = await getRunDetail(run.runId);
    expect(detail?.run.status).toBe("COMPLETED");
    expect(detail?.attempts[0].transport_status).toBe("TIMEOUT");
    expect(detail?.reconciliations[0].status).toBe("CONFIRMED_APPLIED");
  });

  it("selectively retries only the missing inspection after partial completion", async () => {
    const run = await createAndStartRun({
      claimId: "CLM-1042",
      requestText:
        "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
      plannerMode: "deterministic",
      faultProfileId: "partial-reserve-success-inspection-timeout-before",
      scenarioId: "it-partial"
    });
    const detail = await getRunDetail(run.runId);
    const reserve = detail?.actions.find((action) => action.ordinal === 1);
    const inspection = detail?.actions.find((action) => action.ordinal === 2);
    expect(detail?.run.status).toBe("COMPLETED");
    expect(detail?.attempts.filter((attempt) => attempt.planned_action_id === reserve?.id)).toHaveLength(1);
    expect(detail?.attempts.filter((attempt) => attempt.planned_action_id === inspection?.id)).toHaveLength(2);
  });

  it("invalidates review approval after source state changes", async () => {
    const run = await createAndStartRun({
      claimId: "CLM-2048",
      requestText: "Issue the agreed $42,500 settlement.",
      plannerMode: "deterministic",
      faultProfileId: "none",
      scenarioId: "it-review-invalidated"
    });
    const detail = await getRunDetail(run.runId);
    await bumpClaimVersion("CLM-2048");
    const result = await decideReview({
      reviewId: detail?.reviews[0].id,
      decision: "APPROVE",
      actorId: "reviewer"
    });
    const after = await getRunDetail(run.runId);
    expect(result.status).toBe("REPLAN_REQUIRED");
    expect(after?.reviews[0].status).toBe("INVALIDATED");
    expect(after?.finalClaim?.settlements).toHaveLength(0);
  });

  it("runs all deterministic eval cases through the coordinator", async () => {
    const result = await runEvalSuite();
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(12);
  });
});
