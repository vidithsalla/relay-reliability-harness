import { isRetryableAction } from "@/lib/policies/risk-policy";
import type { PlannedActionRecord, RecoveryDecisionType } from "@/lib/domain/types";
import type { ReconciliationResult } from "@/lib/reconciliation/reconciliation-engine";

export type RecoveryDecision = {
  decision: RecoveryDecisionType;
  reasonCode: string;
  reasonSummary: string;
};

export function decideRecovery(input: {
  action: PlannedActionRecord;
  reconciliation: ReconciliationResult;
  attemptCount: number;
  maxAttempts: number;
}): RecoveryDecision {
  const { action, reconciliation, attemptCount, maxAttempts } = input;
  switch (reconciliation.status) {
    case "CONFIRMED_APPLIED":
    case "NO_OP_DUPLICATE":
      return {
        decision: "COMPLETE",
        reasonCode: "EFFECT_CONFIRMED",
        reasonSummary: "Required business effect is confirmed by authoritative evidence."
      };
    case "CONFIRMED_NOT_APPLIED":
      if (isRetryableAction(action.actionType) && attemptCount < maxAttempts) {
        return {
          decision: "RETRY_ACTION",
          reasonCode: "SAFE_RETRY_CONFIRMED_NOT_APPLIED",
          reasonSummary: "Read-back proves the effect is absent and the action is retryable."
        };
      }
      return {
        decision: "MANUAL_INVESTIGATION_REQUIRED",
        reasonCode: "RETRY_EXHAUSTED_OR_UNSAFE",
        reasonSummary: "The effect was not applied, but retry is exhausted or not allowed."
      };
    case "PARTIALLY_APPLIED":
      return {
        decision: "MANUAL_INVESTIGATION_REQUIRED",
        reasonCode: "PARTIAL_EFFECT_REQUIRES_OPERATOR",
        reasonSummary: "Partial application is not safely repairable in v1."
      };
    case "CONFLICTED":
      return {
        decision: "REPLAN_REQUIRED",
        reasonCode: "VERSION_OR_STATE_CONFLICT",
        reasonSummary: "Source state changed relative to the planned expected version."
      };
    case "UNKNOWN":
      return {
        decision: "MANUAL_INVESTIGATION_REQUIRED",
        reasonCode: "UNKNOWN_MUTATION_OUTCOME",
        reasonSummary: "Relay cannot safely prove whether the mutation did or did not happen."
      };
    case "BLOCKED_PRECONDITION":
      return {
        decision: "FAIL_CLOSED",
        reasonCode: "PRECONDITION_BLOCKED",
        reasonSummary: "The request violates deterministic business preconditions."
      };
    case "REVIEW_REQUIRED":
      return {
        decision: "HUMAN_REVIEW_REQUIRED",
        reasonCode: "POLICY_REVIEW_REQUIRED",
        reasonSummary: "Deterministic policy requires reviewer approval before execution."
      };
  }
}
