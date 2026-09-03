import { describe, expect, it } from "vitest";

import type { PlannedActionRecord } from "@/lib/domain/types";
import { decideRecovery } from "@/lib/recovery/recovery-engine";

const action: PlannedActionRecord = {
  id: "action",
  planId: "plan",
  ordinal: 1,
  actionType: "SCHEDULE_INSPECTION",
  argumentsJson: { network: "Preferred Body Network" },
  riskLevel: "LOW",
  expectedVersionAtPlan: 17,
  idempotencyKey: "key",
  status: "READY"
};

describe("recovery", () => {
  it("retries only when reconciliation proves not applied", () => {
    const decision = decideRecovery({
      action,
      attemptCount: 1,
      maxAttempts: 2,
      reconciliation: {
        status: "CONFIRMED_NOT_APPLIED",
        desiredEffect: { type: "SCHEDULE_INSPECTION", network: "Preferred Body Network", idempotencyKey: "key" },
        observedEffect: null,
        evidence: {},
        reasonCode: "ABSENT",
        reasonSummary: "absent"
      }
    });
    expect(decision.decision).toBe("RETRY_ACTION");
  });

  it("routes unknown mutation outcomes to manual investigation", () => {
    const decision = decideRecovery({
      action,
      attemptCount: 1,
      maxAttempts: 2,
      reconciliation: {
        status: "UNKNOWN",
        desiredEffect: { type: "SCHEDULE_INSPECTION", network: "Preferred Body Network", idempotencyKey: "key" },
        observedEffect: null,
        evidence: {},
        reasonCode: "UNKNOWN",
        reasonSummary: "unknown"
      }
    });
    expect(decision.decision).toBe("MANUAL_INVESTIGATION_REQUIRED");
  });
});
