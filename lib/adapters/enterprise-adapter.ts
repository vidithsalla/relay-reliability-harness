import type {
  AdapterMutationResult,
  ClaimAggregate,
  TransportStatus
} from "@/lib/domain/types";

export type MutationContext = {
  expectedVersion: number;
  idempotencyKey: string;
  attemptNumber: number;
};

export type SetReserveInput = {
  claimId: string;
  reserveAmountCents: number;
};

export type ScheduleInspectionInput = {
  claimId: string;
  network: string;
};

export type IssueSettlementInput = {
  claimId: string;
  amountCents: number;
};

export type AddClaimNoteInput = {
  claimId: string;
  body: string;
};

export interface EnterpriseAdapter {
  getClaim(claimId: string): Promise<ClaimAggregate>;
  setReserve(input: SetReserveInput, ctx: MutationContext): Promise<AdapterMutationResult>;
  scheduleInspection(
    input: ScheduleInspectionInput,
    ctx: MutationContext
  ): Promise<AdapterMutationResult>;
  issueSettlement(
    input: IssueSettlementInput,
    ctx: MutationContext
  ): Promise<AdapterMutationResult>;
  addClaimNote(input: AddClaimNoteInput, ctx: MutationContext): Promise<AdapterMutationResult>;
}

export function resultFromLedger(version: number, responseJson: Record<string, unknown>): AdapterMutationResult {
  return {
    transportStatus: "IDEMPOTENT_REPLAY" satisfies TransportStatus,
    returnedVersion: version,
    operationId: typeof responseJson.operationId === "string" ? responseJson.operationId : null,
    responseJson
  };
}
