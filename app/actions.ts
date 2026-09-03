"use server";

import { redirect } from "next/navigation";

import { runEvalSuite } from "@/lib/eval/eval-suite";
import { scenarios } from "@/lib/fixtures/scenarios";
import { resetClaimFixtures } from "@/lib/services/seed-service";
import { createAndStartRun, decideReview, replayRun } from "@/lib/services/run-service";

export async function runScenarioAction(formData: FormData) {
  const scenarioId = String(formData.get("scenarioId"));
  const scenario = scenarios.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error("Unknown scenario.");
  await resetClaimFixtures([scenario.claimId]);
  const result = await createAndStartRun({
    claimId: scenario.claimId,
    requestText: scenario.requestText,
    plannerMode: "deterministic",
    faultProfileId: scenario.faultProfileId,
    scenarioId: scenario.id,
    actorId: "operator"
  });
  redirect(`/runs/${result.runId}`);
}

export async function replayRunAction(formData: FormData) {
  const runId = String(formData.get("runId"));
  const result = await replayRun(runId);
  redirect(`/runs/${result.runId}`);
}

export async function reviewDecisionAction(formData: FormData) {
  const reviewId = String(formData.get("reviewId"));
  const decision = String(formData.get("decision")) as "APPROVE" | "REJECT";
  const note = String(formData.get("note") ?? "");
  const result = await decideReview({ reviewId, decision, note, actorId: "reviewer" });
  redirect(`/runs/${result.runId}`);
}

export async function runEvalAction() {
  await runEvalSuite();
  redirect("/evals");
}
