import { demoActorId, demoClaimId } from "@/lib/demo/ids";
import { scenarios } from "@/lib/fixtures/scenarios";
import { resetDemoClaimFixture } from "@/lib/services/seed-service";
import { createAndStartRun } from "@/lib/services/run-service";

export async function runDemoScenario(scenarioId: string, demoSessionId: string) {
  const scenario = scenarios.find((item) => item.id === scenarioId);
  if (!scenario) {
    throw new Error("Unknown scenario.");
  }

  const claimId = await resetDemoClaimFixture(scenario.claimId, demoSessionId);
  const common = {
    claimId,
    requestText: scenario.requestText,
    plannerMode: "deterministic" as const,
    faultProfileId: scenario.faultProfileId,
    actorId: demoActorId(demoSessionId),
    demoSessionId
  };

  if (scenario.runMode === "duplicate") {
    const logicalRunNamespace = `${demoSessionId}:${scenario.id}`;
    await createAndStartRun({
      ...common,
      scenarioId: `${scenario.id}-first-delivery`,
      logicalRunNamespace
    });
    return createAndStartRun({
      ...common,
      scenarioId: scenario.id,
      logicalRunNamespace
    });
  }

  return createAndStartRun({
    ...common,
    scenarioId: scenario.id,
    logicalRunNamespace: `${demoSessionId}:${scenario.id}:${Date.now()}`
  });
}

export function scenarioDemoClaimId(scenarioId: string, demoSessionId: string): string {
  const scenario = scenarios.find((item) => item.id === scenarioId);
  if (!scenario) {
    throw new Error("Unknown scenario.");
  }
  return demoClaimId(scenario.claimId, demoSessionId);
}
