import OpenAI from "openai";

import { ActionPlanDraftSchema, type ActionPlanDraft, type ClaimAggregate } from "@/lib/domain/types";

export type PlannerInput = {
  requestText: string;
  claim: ClaimAggregate;
  allowedActions: string[];
  policyContext: {
    autonomousSettlementLimitCents: number;
  };
};

export interface PlannerProvider {
  readonly provider: string;
  readonly model: string | null;
  createPlan(input: PlannerInput): Promise<ActionPlanDraft>;
}

export class DeterministicPlannerProvider implements PlannerProvider {
  readonly provider = "deterministic";
  readonly model = null;

  async createPlan(input: PlannerInput): Promise<ActionPlanDraft> {
    const text = input.requestText.toLowerCase();
    if (input.claim.id === "CLM-1042" && text.includes("reserve") && text.includes("inspection")) {
      return {
        kind: "PLAN",
        claimId: input.claim.id,
        rationaleSummary:
          "Update reserve to the known repair estimate and schedule inspection with the preferred network.",
        actions: [
          { type: "SET_RESERVE", reserveAmountCents: 840000 },
          { type: "SCHEDULE_INSPECTION", network: "Preferred Body Network" }
        ]
      };
    }
    if (text.includes("settlement")) {
      const amount = text.includes("9,500") || text.includes("9500") ? 950000 : 4250000;
      return {
        kind: "PLAN",
        claimId: input.claim.id,
        rationaleSummary: "Issue the requested settlement as a typed enterprise mutation proposal.",
        actions: [{ type: "ISSUE_SETTLEMENT", amountCents: amount }]
      };
    }
    if (text.includes("inspection")) {
      return {
        kind: "PLAN",
        claimId: input.claim.id,
        rationaleSummary: "Schedule the requested inspection.",
        actions: [{ type: "SCHEDULE_INSPECTION", network: "Preferred Body Network" }]
      };
    }
    if (text.includes("note")) {
      return {
        kind: "PLAN",
        claimId: input.claim.id,
        rationaleSummary: "Add the requested note to the claim.",
        actions: [{ type: "ADD_CLAIM_NOTE", body: input.requestText.slice(0, 1000) }]
      };
    }
    return {
      kind: "UNSUPPORTED",
      claimId: input.claim.id,
      reason: "The deterministic planner could not map the request to the allowed action catalog."
    };
  }
}

export class XaiPlannerProvider implements PlannerProvider {
  readonly provider = "grok";
  readonly model = process.env.XAI_MODEL ?? "grok-4.6";

  async createPlan(input: PlannerInput): Promise<ActionPlanDraft> {
    if (!process.env.XAI_API_KEY) {
      return {
        kind: "UNSUPPORTED",
        claimId: input.claim.id,
        reason: "XAI_API_KEY is not configured."
      };
    }
    const client = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: process.env.XAI_BASE_URL ?? "https://api.x.ai/v1"
    });
    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "You are a planning component inside a synthetic enterprise claims demo. Convert the user request into allowed typed actions only. Do not authorize, invent claim facts, set idempotency keys, or mark success."
        },
        {
          role: "user",
          content: JSON.stringify({
            requestText: input.requestText,
            claim: {
              id: input.claim.id,
              status: input.claim.status,
              reserveAmountCents: input.claim.reserveAmountCents,
              estimatedLossCents: input.claim.estimatedLossCents,
              version: input.claim.version
            },
            allowedActions: input.allowedActions,
            policyContext: input.policyContext
          })
        }
      ],
      response_format: { type: "json_object" }
    });
    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error("xAI planner returned no structured content.");
    }
    return ActionPlanDraftSchema.parse(JSON.parse(content));
  }
}

export function getPlannerProvider(mode: "deterministic" | "grok"): PlannerProvider {
  return mode === "grok" ? new XaiPlannerProvider() : new DeterministicPlannerProvider();
}
