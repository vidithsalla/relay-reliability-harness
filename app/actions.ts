"use server";

import { redirect } from "next/navigation";

import { runEvalSuite } from "@/lib/eval/eval-suite";
import { canRunEvalMutation } from "@/lib/eval/permissions";
import { scenarios } from "@/lib/fixtures/scenarios";
import { demoReviewerActorId, getOrCreateDemoSessionId } from "@/lib/demo/session";
import { runDemoScenario } from "@/lib/services/demo-scenario-service";
import { decideReview, replayRun } from "@/lib/services/run-service";

export async function runScenarioAction(formData: FormData) {
  const scenarioId = String(formData.get("scenarioId"));
  const scenario = scenarios.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error("Unknown scenario.");
  const demoSessionId = await getOrCreateDemoSessionId();
  const result = await runDemoScenario(scenario.id, demoSessionId);
  redirect(`/runs/${result.runId}`);
}

export async function replayRunAction(formData: FormData) {
  const runId = String(formData.get("runId"));
  assertUuid(runId);
  const result = await replayRun(runId, await getOrCreateDemoSessionId());
  redirect(`/runs/${result.runId}`);
}

export async function reviewDecisionAction(formData: FormData) {
  const reviewId = String(formData.get("reviewId"));
  const decision = String(formData.get("decision")) as "APPROVE" | "REJECT";
  const note = String(formData.get("note") ?? "");
  assertUuid(reviewId);
  if (decision !== "APPROVE" && decision !== "REJECT") throw new Error("Invalid review decision.");
  const demoSessionId = await getOrCreateDemoSessionId();
  const result = await decideReview({ reviewId, decision, note, actorId: demoReviewerActorId(demoSessionId), demoSessionId });
  redirect(`/runs/${result.runId}`);
}

export async function runEvalAction() {
  if (!canRunEvalMutation()) {
    throw new Error("Running evals is disabled in the hosted demo.");
  }
  await runEvalSuite();
  redirect("/evals");
}

function assertUuid(value: string) {
  if (!/^[a-f0-9-]{36}$/i.test(value)) {
    throw new Error("Invalid identifier.");
  }
}
