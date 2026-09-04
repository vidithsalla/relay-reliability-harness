export type Scenario = {
  id: string;
  title: string;
  claimId: string;
  requestText: string;
  faultProfileId: string;
  expectedBehavior: string;
  category: "core" | "review" | "manual" | "conflict";
  runMode?: "normal" | "duplicate";
};

export const scenarios: Scenario[] = [
  {
    id: "happy-path",
    title: "Happy path",
    claimId: "CLM-1042",
    requestText:
      "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
    faultProfileId: "none",
    expectedBehavior: "Both actions are confirmed by read-back and the run completes.",
    category: "core"
  },
  {
    id: "timeout-before-write",
    title: "Timeout before write",
    claimId: "CLM-1042",
    requestText:
      "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
    faultProfileId: "timeout-before-write-reserve",
    expectedBehavior: "Read-back proves reserve was not applied, so Relay retries only the safe action.",
    category: "core"
  },
  {
    id: "timeout-after-write",
    title: "Timeout after write",
    claimId: "CLM-1042",
    requestText:
      "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
    faultProfileId: "timeout-after-write-reserve",
    expectedBehavior: "Transport times out, read-back proves the reserve changed, and Relay prevents a duplicate retry.",
    category: "core"
  },
  {
    id: "partial-completion",
    title: "Partial completion",
    claimId: "CLM-1042",
    requestText:
      "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
    faultProfileId: "partial-reserve-success-inspection-timeout-before",
    expectedBehavior: "Reserve remains completed and only inspection gets a second attempt.",
    category: "core"
  },
  {
    id: "stale-state",
    title: "Stale state",
    claimId: "CLM-1042",
    requestText:
      "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
    faultProfileId: "stale-version-before-second-action",
    expectedBehavior: "External version change blocks the second action and requires replan.",
    category: "conflict"
  },
  {
    id: "high-risk-settlement",
    title: "High-risk settlement",
    claimId: "CLM-2048",
    requestText: "Issue the agreed $42,500 settlement.",
    faultProfileId: "none",
    expectedBehavior: "Settlement waits for reviewer approval and then revalidates before execution.",
    category: "review"
  },
  {
    id: "duplicate-request",
    title: "Duplicate request",
    claimId: "CLM-1042",
    requestText:
      "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
    faultProfileId: "none",
    expectedBehavior: "The second delivery uses the same semantic idempotency namespace and becomes a no-op duplicate.",
    category: "core",
    runMode: "duplicate"
  },
  {
    id: "retry-exhaustion",
    title: "Retry exhaustion",
    claimId: "CLM-1042",
    requestText: "Schedule another inspection.",
    faultProfileId: "retry-exhaustion-inspection",
    expectedBehavior: "Repeated before-write failures stop at the retry limit and require manual investigation.",
    category: "manual"
  },
  {
    id: "ambiguous-outcome",
    title: "Ambiguous outcome",
    claimId: "CLM-2048",
    requestText: "Issue the agreed $9,500 settlement.",
    faultProfileId: "ambiguous-write-and-readback-timeout",
    expectedBehavior: "Possible settlement plus failed read-back becomes manual investigation, not retry.",
    category: "manual"
  }
];
