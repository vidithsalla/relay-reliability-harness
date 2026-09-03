import { matchDesiredEffect, type DesiredEffect } from "@/lib/domain/desired-effects";
import type {
  AdapterMutationResult,
  ClaimAggregate,
  PlannedActionRecord,
  ReconciliationStatus
} from "@/lib/domain/types";

export type AttemptEvidence = {
  transportStatus: AdapterMutationResult["transportStatus"];
  errorCode: string | null;
  errorMessage: string | null;
  delegateDefinitelyNotCalled: boolean;
  versionConflict: boolean;
};

export type ReconciliationResult = {
  status: ReconciliationStatus;
  desiredEffect: DesiredEffect;
  observedEffect: Record<string, unknown> | null;
  evidence: Record<string, unknown>;
  reasonCode: string;
  reasonSummary: string;
};

export function reconcile(input: {
  action: PlannedActionRecord;
  desiredEffect: DesiredEffect;
  preState: ClaimAggregate;
  attempt: AttemptEvidence;
  postState?: ClaimAggregate;
  postStateReadError?: { code: string; message: string };
  blockedBeforeAdapter?: boolean;
}): ReconciliationResult {
  if (input.blockedBeforeAdapter) {
    return result("BLOCKED_PRECONDITION", "PRECONDITION_BLOCKED", "Action was blocked before adapter execution.", input, null);
  }
  if (input.attempt.versionConflict) {
    return result("CONFLICTED", "VERSION_CONFLICT", "Adapter observed a version conflict before applying the effect.", input, null);
  }
  if (input.attempt.transportStatus === "IDEMPOTENT_REPLAY") {
    if (input.postState) {
      const match = matchDesiredEffect(input.desiredEffect, input.postState);
      if (match.full) {
        return result("NO_OP_DUPLICATE", "IDEMPOTENT_REPLAY_CONFIRMED", "Idempotency ledger returned the prior logical result and read-back confirms the desired effect.", input, match.observed);
      }
    }
    return result("UNKNOWN", "IDEMPOTENT_REPLAY_UNVERIFIED", "Idempotent replay could not be verified by read-back.", input, null);
  }
  if (!input.postState) {
    if (input.attempt.delegateDefinitelyNotCalled) {
      return result("CONFIRMED_NOT_APPLIED", "DELEGATE_NOT_CALLED", "Fault evidence proves the delegate mutation did not run.", input, null);
    }
    return result("UNKNOWN", "READBACK_UNAVAILABLE", "Authoritative read-back failed after a mutation with possible side effects.", input, null);
  }

  const match = matchDesiredEffect(input.desiredEffect, input.postState);
  if (match.full) {
    return result("CONFIRMED_APPLIED", "DESIRED_EFFECT_OBSERVED", "Authoritative read-back contains the intended business effect.", input, match.observed);
  }
  if (match.partial) {
    return result("PARTIALLY_APPLIED", "PARTIAL_EFFECT_OBSERVED", "Authoritative read-back contains only part of the intended business effect.", input, match.observed);
  }
  if (input.postState.version !== input.preState.version && input.action.actionType !== "SET_RESERVE") {
    return result("CONFLICTED", "INCOMPATIBLE_STATE_CHANGE", "Authoritative state changed without the desired effect being present.", input, match.observed);
  }
  return result("CONFIRMED_NOT_APPLIED", "EFFECT_ABSENT_AFTER_READBACK", "Read-back succeeded and the intended effect is absent.", input, match.observed);
}

function result(
  status: ReconciliationStatus,
  reasonCode: string,
  reasonSummary: string,
  input: {
    desiredEffect: DesiredEffect;
    preState: ClaimAggregate;
    postState?: ClaimAggregate;
    postStateReadError?: { code: string; message: string };
    attempt: AttemptEvidence;
  },
  observedEffect: Record<string, unknown> | null
): ReconciliationResult {
  return {
    status,
    desiredEffect: input.desiredEffect,
    observedEffect,
    evidence: {
      transportStatus: input.attempt.transportStatus,
      preVersion: input.preState.version,
      postVersion: input.postState?.version ?? null,
      readbackError: input.postStateReadError ?? null,
      delegateDefinitelyNotCalled: input.attempt.delegateDefinitelyNotCalled
    },
    reasonCode,
    reasonSummary
  };
}
