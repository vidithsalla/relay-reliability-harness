import type { ActionArguments, ActionType, ClaimAggregate, RiskLevel } from "@/lib/domain/types";

export const AUTONOMOUS_SETTLEMENT_LIMIT_CENTS = 1000000;

export type PolicyResult =
  | { ok: true; riskLevel: RiskLevel; requiresReview: boolean; reasonCode: string; reasonSummary: string }
  | { ok: false; riskLevel: RiskLevel; requiresReview: false; reasonCode: string; reasonSummary: string };

export function evaluateActionPolicy(input: {
  actionType: ActionType;
  argumentsJson: ActionArguments;
  claim: ClaimAggregate;
}): PolicyResult {
  const { actionType, argumentsJson, claim } = input;
  if (actionType === "SET_RESERVE") {
    const amount = (argumentsJson as { reserveAmountCents: number }).reserveAmountCents;
    if (amount < 0) {
      return blocked("LOW", "NEGATIVE_RESERVE", "Reserve cannot be negative.");
    }
    return allowed(amount > 5000000 ? "MEDIUM" : "LOW", false, "RESERVE_ALLOWED", "Reserve update is within deterministic policy.");
  }

  if (actionType === "SCHEDULE_INSPECTION") {
    if (claim.status === "CLOSED") {
      return blocked("LOW", "CLOSED_CLAIM_INSPECTION", "Inspection cannot be scheduled on a closed claim.");
    }
    return allowed("LOW", false, "INSPECTION_ALLOWED", "Inspection scheduling is allowed for the current claim state.");
  }

  if (actionType === "ISSUE_SETTLEMENT") {
    const amount = (argumentsJson as { amountCents: number }).amountCents;
    if (claim.status !== "OPEN" && claim.status !== "NEGOTIATING") {
      return blocked("HIGH", "SETTLEMENT_STATE_ILLEGAL", "Settlement is only allowed for open or negotiating claims.");
    }
    if (amount > AUTONOMOUS_SETTLEMENT_LIMIT_CENTS) {
      return allowed("HIGH", true, "SETTLEMENT_REVIEW_REQUIRED", "Settlement exceeds the autonomous threshold and requires reviewer approval.");
    }
    return allowed("MEDIUM", false, "SETTLEMENT_ALLOWED", "Settlement is within autonomous threshold and current state allows it.");
  }

  return allowed("LOW", false, "NOTE_ALLOWED", "Claim note is allowed.");
}

function allowed(
  riskLevel: RiskLevel,
  requiresReview: boolean,
  reasonCode: string,
  reasonSummary: string
): PolicyResult {
  return { ok: true, riskLevel, requiresReview, reasonCode, reasonSummary };
}

function blocked(
  riskLevel: RiskLevel,
  reasonCode: string,
  reasonSummary: string
): PolicyResult {
  return { ok: false, riskLevel, requiresReview: false, reasonCode, reasonSummary };
}

export function canActorReview(actorId: string): boolean {
  return actorId === "reviewer" || actorId.startsWith("reviewer:demo_");
}

export function isRetryableAction(actionType: ActionType): boolean {
  return actionType === "SET_RESERVE" || actionType === "SCHEDULE_INSPECTION" || actionType === "ADD_CLAIM_NOTE";
}
