import { describe, expect, it } from "vitest";

import { desiredEffectForAction } from "@/lib/domain/desired-effects";
import type { ClaimAggregate, PlannedActionRecord } from "@/lib/domain/types";
import { reconcile } from "@/lib/reconciliation/reconciliation-engine";

const pre: ClaimAggregate = {
  id: "CLM-1042",
  status: "OPEN",
  claimantName: "Alex Morgan",
  lossType: "AUTO_COLLISION",
  reserveAmountCents: 500000,
  estimatedLossCents: 840000,
  version: 17,
  inspections: [],
  settlements: [],
  notes: []
};

const action: PlannedActionRecord = {
  id: "action",
  planId: "plan",
  ordinal: 1,
  actionType: "SET_RESERVE",
  argumentsJson: { reserveAmountCents: 840000 },
  riskLevel: "LOW",
  expectedVersionAtPlan: 17,
  idempotencyKey: "key",
  status: "READY"
};

describe("reconciliation", () => {
  it("confirms applied when read-back contains desired effect despite timeout", () => {
    const result = reconcile({
      action,
      desiredEffect: desiredEffectForAction({
        actionType: action.actionType,
        argumentsJson: action.argumentsJson,
        idempotencyKey: action.idempotencyKey
      }),
      preState: pre,
      attempt: {
        transportStatus: "TIMEOUT",
        errorCode: "ENTERPRISE_TIMEOUT",
        errorMessage: "timeout",
        delegateDefinitelyNotCalled: false,
        versionConflict: false
      },
      postState: { ...pre, reserveAmountCents: 840000, version: 18 }
    });
    expect(result.status).toBe("CONFIRMED_APPLIED");
  });

  it("returns unknown when read-back fails after possible side effect", () => {
    const result = reconcile({
      action,
      desiredEffect: desiredEffectForAction({
        actionType: action.actionType,
        argumentsJson: action.argumentsJson,
        idempotencyKey: action.idempotencyKey
      }),
      preState: pre,
      attempt: {
        transportStatus: "TIMEOUT",
        errorCode: "ENTERPRISE_TIMEOUT",
        errorMessage: "timeout",
        delegateDefinitelyNotCalled: false,
        versionConflict: false
      },
      postStateReadError: { code: "READBACK_FAILED", message: "read failed" }
    });
    expect(result.status).toBe("UNKNOWN");
  });
});
