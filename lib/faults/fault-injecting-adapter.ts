import {
  EnterpriseMalformedResponseError,
  EnterpriseTimeoutError,
  EnterpriseTransientError
} from "@/lib/domain/errors";
import type {
  AdapterMutationResult,
  ClaimAggregate,
  FaultPhase,
  FaultProfileConfig
} from "@/lib/domain/types";
import { bumpClaimVersion } from "@/lib/services/seed-service";

import type {
  AddClaimNoteInput,
  EnterpriseAdapter,
  IssueSettlementInput,
  MutationContext,
  ScheduleInspectionInput,
  SetReserveInput
} from "../adapters/enterprise-adapter";

export type FaultContext = {
  actionOrdinal: number;
  attemptNumber: number;
};

export type InjectedFault = {
  phase: FaultPhase;
  fault: string;
  summary: string;
};

export class FaultRecorder {
  readonly injected: InjectedFault[] = [];

  record(fault: InjectedFault) {
    this.injected.push(fault);
  }
}

export class FaultInjectingAdapter implements EnterpriseAdapter {
  constructor(
    private readonly delegate: EnterpriseAdapter,
    private readonly profile: FaultProfileConfig,
    private readonly context: FaultContext,
    private readonly recorder: FaultRecorder
  ) {}

  async getClaim(claimId: string): Promise<ClaimAggregate> {
    const rule = this.findRule("READBACK");
    if (rule?.fault === "TIMEOUT") {
      this.recorder.record({
        phase: "READBACK",
        fault: "TIMEOUT",
        summary: `Injected read-back timeout for action ${this.context.actionOrdinal} attempt ${this.context.attemptNumber}.`
      });
      throw new EnterpriseTimeoutError("Authoritative read-back timed out.");
    }
    return this.delegate.getClaim(claimId);
  }

  async setReserve(input: SetReserveInput, ctx: MutationContext): Promise<AdapterMutationResult> {
    return this.withFaults(input.claimId, () => this.delegate.setReserve(input, ctx));
  }

  async scheduleInspection(
    input: ScheduleInspectionInput,
    ctx: MutationContext
  ): Promise<AdapterMutationResult> {
    return this.withFaults(input.claimId, () => this.delegate.scheduleInspection(input, ctx));
  }

  async issueSettlement(
    input: IssueSettlementInput,
    ctx: MutationContext
  ): Promise<AdapterMutationResult> {
    return this.withFaults(input.claimId, () => this.delegate.issueSettlement(input, ctx));
  }

  async addClaimNote(input: AddClaimNoteInput, ctx: MutationContext): Promise<AdapterMutationResult> {
    return this.withFaults(input.claimId, () => this.delegate.addClaimNote(input, ctx));
  }

  private async withFaults(
    claimId: string,
    delegateCall: () => Promise<AdapterMutationResult>
  ): Promise<AdapterMutationResult> {
    const before = this.findRule("BEFORE_WRITE");
    if (before) {
      if (before.fault === "EXTERNAL_VERSION_BUMP") {
        const version = await bumpClaimVersion(claimId);
        this.recorder.record({
          phase: "BEFORE_WRITE",
          fault: before.fault,
          summary: `Injected external version bump; observed version is now ${version}.`
        });
      } else {
        this.recorder.record({
          phase: "BEFORE_WRITE",
          fault: before.fault,
          summary: `Injected ${before.fault.toLowerCase()} before delegate mutation.`
        });
        throw faultToError(before.fault);
      }
    }

    const result = await delegateCall();
    const after = this.findRule("AFTER_WRITE");
    if (!after) {
      return result;
    }
    this.recorder.record({
      phase: "AFTER_WRITE",
      fault: after.fault,
      summary: `Injected ${after.fault.toLowerCase()} after delegate mutation committed.`
    });
    if (after.fault === "MALFORMED_RESPONSE") {
      throw new EnterpriseMalformedResponseError();
    }
    throw faultToError(after.fault);
  }

  private findRule(phase: FaultPhase) {
    return this.profile.rules.find(
      (rule) =>
        rule.actionOrdinal === this.context.actionOrdinal &&
        rule.attemptNumber === this.context.attemptNumber &&
        rule.phase === phase
    );
  }
}

function faultToError(fault: string): Error {
  if (fault === "TRANSIENT_ERROR") {
    return new EnterpriseTransientError();
  }
  if (fault === "MALFORMED_RESPONSE") {
    return new EnterpriseMalformedResponseError();
  }
  return new EnterpriseTimeoutError();
}
