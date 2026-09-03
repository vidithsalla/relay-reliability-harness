import { z } from "zod";

export const runStatuses = [
  "CREATED",
  "PLANNING",
  "PLAN_INVALID",
  "READY",
  "EXECUTING",
  "WAITING_REVIEW",
  "RETRYING",
  "REPLAN_REQUIRED",
  "MANUAL_INVESTIGATION",
  "FAILED_CLOSED",
  "COMPLETED"
] as const;

export const actionStatuses = [
  "PLANNED",
  "BLOCKED_PRECONDITION",
  "WAITING_REVIEW",
  "READY",
  "EXECUTING",
  "RECONCILING",
  "RETRY_SCHEDULED",
  "COMPLETED",
  "REPLAN_REQUIRED",
  "MANUAL_INVESTIGATION",
  "REJECTED"
] as const;

export const actionTypes = [
  "SET_RESERVE",
  "SCHEDULE_INSPECTION",
  "ISSUE_SETTLEMENT",
  "ADD_CLAIM_NOTE"
] as const;

export const reconciliationStatuses = [
  "CONFIRMED_APPLIED",
  "CONFIRMED_NOT_APPLIED",
  "PARTIALLY_APPLIED",
  "CONFLICTED",
  "UNKNOWN",
  "NO_OP_DUPLICATE",
  "BLOCKED_PRECONDITION",
  "REVIEW_REQUIRED"
] as const;

export const recoveryDecisions = [
  "COMPLETE",
  "RETRY_ACTION",
  "RETRY_MISSING_ACTIONS",
  "REPLAN_REQUIRED",
  "HUMAN_REVIEW_REQUIRED",
  "MANUAL_INVESTIGATION_REQUIRED",
  "FAIL_CLOSED"
] as const;

export type RunStatus = (typeof runStatuses)[number];
export type ActionStatus = (typeof actionStatuses)[number];
export type ActionType = (typeof actionTypes)[number];
export type ReconciliationStatus = (typeof reconciliationStatuses)[number];
export type RecoveryDecisionType = (typeof recoveryDecisions)[number];
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type ClaimStatus = "OPEN" | "NEGOTIATING" | "CLOSED";
export type PlannerMode = "deterministic" | "grok";
export type TransportStatus =
  | "SUCCESS_RESPONSE"
  | "TIMEOUT"
  | "TRANSIENT_ERROR"
  | "VERSION_CONFLICT"
  | "MALFORMED_RESPONSE"
  | "IDEMPOTENT_REPLAY"
  | "UNKNOWN_ERROR";

export const SetReserveArgsSchema = z.object({
  reserveAmountCents: z.number().int().nonnegative()
});

export const ScheduleInspectionArgsSchema = z.object({
  network: z.string().min(1).max(100)
});

export const IssueSettlementArgsSchema = z.object({
  amountCents: z.number().int().positive()
});

export const AddClaimNoteArgsSchema = z.object({
  body: z.string().min(1).max(1000)
});

export const ActionDraftSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SET_RESERVE"),
    reserveAmountCents: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal("SCHEDULE_INSPECTION"),
    network: z.string().min(1).max(100)
  }),
  z.object({
    type: z.literal("ISSUE_SETTLEMENT"),
    amountCents: z.number().int().positive()
  }),
  z.object({
    type: z.literal("ADD_CLAIM_NOTE"),
    body: z.string().min(1).max(1000)
  })
]);

export const ActionPlanDraftSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("PLAN"),
    claimId: z.string(),
    rationaleSummary: z.string().max(500),
    actions: z.array(ActionDraftSchema).min(1).max(4)
  }),
  z.object({
    kind: z.literal("UNSUPPORTED"),
    claimId: z.string(),
    reason: z.string().max(500)
  })
]);

export type ActionDraft = z.infer<typeof ActionDraftSchema>;
export type ActionPlanDraft = z.infer<typeof ActionPlanDraftSchema>;

export type ClaimAggregate = {
  id: string;
  status: ClaimStatus;
  claimantName: string;
  lossType: string;
  reserveAmountCents: number;
  estimatedLossCents: number | null;
  version: number;
  inspections: Array<{
    id: string;
    network: string;
    status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
    scheduledFor: string | null;
    idempotencyKey: string;
    createdAt: string;
  }>;
  settlements: Array<{
    id: string;
    amountCents: number;
    status: "ISSUED" | "VOIDED";
    idempotencyKey: string;
    createdAt: string;
  }>;
  notes: Array<{
    id: string;
    body: string;
    idempotencyKey: string;
    createdAt: string;
  }>;
};

export type PlannedActionRecord = {
  id: string;
  planId: string;
  ordinal: number;
  actionType: ActionType;
  argumentsJson: ActionArguments;
  riskLevel: RiskLevel;
  expectedVersionAtPlan: number;
  idempotencyKey: string;
  status: ActionStatus;
};

export type ActionArguments =
  | { reserveAmountCents: number }
  | { network: string }
  | { amountCents: number }
  | { body: string };

export type AdapterMutationResult = {
  transportStatus: TransportStatus;
  returnedVersion: number | null;
  operationId: string | null;
  responseJson: Record<string, unknown> | null;
};

export type FaultKind =
  | "TIMEOUT"
  | "TRANSIENT_ERROR"
  | "MALFORMED_RESPONSE"
  | "EXTERNAL_VERSION_BUMP";

export type FaultPhase = "BEFORE_WRITE" | "AFTER_WRITE" | "READBACK";

export const FaultProfileConfigSchema = z.object({
  seed: z.number().int(),
  rules: z.array(
    z.object({
      actionOrdinal: z.number().int().positive(),
      attemptNumber: z.number().int().positive(),
      phase: z.enum(["BEFORE_WRITE", "AFTER_WRITE", "READBACK"]),
      fault: z.enum([
        "TIMEOUT",
        "TRANSIENT_ERROR",
        "MALFORMED_RESPONSE",
        "EXTERNAL_VERSION_BUMP"
      ])
    })
  )
});

export type FaultProfileConfig = z.infer<typeof FaultProfileConfigSchema>;
