import type { ActionArguments, ActionType, ClaimAggregate } from "./types";

export type DesiredEffect =
  | { type: "SET_RESERVE"; reserveAmountCents: number }
  | { type: "SCHEDULE_INSPECTION"; network: string; idempotencyKey: string }
  | { type: "ISSUE_SETTLEMENT"; amountCents: number; idempotencyKey: string }
  | { type: "ADD_CLAIM_NOTE"; body: string; idempotencyKey: string };

export type EffectMatch = {
  full: boolean;
  partial: boolean;
  observed: Record<string, unknown>;
};

export function desiredEffectForAction(input: {
  actionType: ActionType;
  argumentsJson: ActionArguments;
  idempotencyKey: string;
}): DesiredEffect {
  switch (input.actionType) {
    case "SET_RESERVE":
      return {
        type: "SET_RESERVE",
        reserveAmountCents: (input.argumentsJson as { reserveAmountCents: number })
          .reserveAmountCents
      };
    case "SCHEDULE_INSPECTION":
      return {
        type: "SCHEDULE_INSPECTION",
        network: (input.argumentsJson as { network: string }).network,
        idempotencyKey: input.idempotencyKey
      };
    case "ISSUE_SETTLEMENT":
      return {
        type: "ISSUE_SETTLEMENT",
        amountCents: (input.argumentsJson as { amountCents: number }).amountCents,
        idempotencyKey: input.idempotencyKey
      };
    case "ADD_CLAIM_NOTE":
      return {
        type: "ADD_CLAIM_NOTE",
        body: (input.argumentsJson as { body: string }).body.trim(),
        idempotencyKey: input.idempotencyKey
      };
  }
}

export function matchDesiredEffect(
  desired: DesiredEffect,
  postState: ClaimAggregate
): EffectMatch {
  switch (desired.type) {
    case "SET_RESERVE":
      return {
        full: postState.reserveAmountCents === desired.reserveAmountCents,
        partial: false,
        observed: {
          reserveAmountCents: postState.reserveAmountCents,
          version: postState.version
        }
      };
    case "SCHEDULE_INSPECTION": {
      const matches = postState.inspections.filter(
        (inspection) => inspection.idempotencyKey === desired.idempotencyKey
      );
      const exact = matches.filter(
        (inspection) =>
          inspection.network === desired.network && inspection.status === "SCHEDULED"
      );
      return {
        full: exact.length === 1,
        partial: matches.length > 0 && exact.length !== 1,
        observed: { matchingInspectionCount: matches.length, exactInspectionCount: exact.length }
      };
    }
    case "ISSUE_SETTLEMENT": {
      const matches = postState.settlements.filter(
        (settlement) => settlement.idempotencyKey === desired.idempotencyKey
      );
      const exact = matches.filter(
        (settlement) =>
          settlement.amountCents === desired.amountCents && settlement.status === "ISSUED"
      );
      return {
        full: exact.length === 1,
        partial: matches.length > 0 && exact.length !== 1,
        observed: { matchingSettlementCount: matches.length, exactSettlementCount: exact.length }
      };
    }
    case "ADD_CLAIM_NOTE": {
      const matches = postState.notes.filter(
        (note) => note.idempotencyKey === desired.idempotencyKey
      );
      const exact = matches.filter((note) => note.body.trim() === desired.body);
      return {
        full: exact.length === 1,
        partial: matches.length > 0 && exact.length !== 1,
        observed: { matchingNoteCount: matches.length, exactNoteCount: exact.length }
      };
    }
  }
}
