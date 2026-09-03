import { describe, expect, it } from "vitest";

import type { ClaimAggregate } from "@/lib/domain/types";
import { evaluateActionPolicy } from "@/lib/policies/risk-policy";

const claim: ClaimAggregate = {
  id: "CLM-1",
  status: "NEGOTIATING",
  claimantName: "Synthetic Person",
  lossType: "AUTO",
  reserveAmountCents: 1000,
  estimatedLossCents: null,
  version: 1,
  inspections: [],
  settlements: [],
  notes: []
};

describe("risk policy", () => {
  it("requires review for settlement over threshold", () => {
    const result = evaluateActionPolicy({
      actionType: "ISSUE_SETTLEMENT",
      argumentsJson: { amountCents: 4250000 },
      claim
    });
    expect(result.ok).toBe(true);
    expect(result.requiresReview).toBe(true);
  });

  it("blocks inspection on closed claims", () => {
    const result = evaluateActionPolicy({
      actionType: "SCHEDULE_INSPECTION",
      argumentsJson: { network: "Preferred Body Network" },
      claim: { ...claim, status: "CLOSED" }
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe("CLOSED_CLAIM_INSPECTION");
  });
});
