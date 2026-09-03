import type { FaultProfileConfig } from "@/lib/domain/types";

export type SeededFaultProfile = {
  id: string;
  name: string;
  description: string;
  config: FaultProfileConfig;
};

export const seededFaultProfiles: SeededFaultProfile[] = [
  {
    id: "none",
    name: "No fault",
    description: "Adapter returns normally; read-back should confirm every intended effect.",
    config: { seed: 1, rules: [] }
  },
  {
    id: "timeout-before-write-reserve",
    name: "Timeout before reserve write",
    description: "The first reserve attempt times out before the source of record is called.",
    config: {
      seed: 2,
      rules: [{ actionOrdinal: 1, attemptNumber: 1, phase: "BEFORE_WRITE", fault: "TIMEOUT" }]
    }
  },
  {
    id: "timeout-after-write-reserve",
    name: "Timeout after reserve write",
    description: "The reserve mutation commits, then the adapter response times out.",
    config: {
      seed: 3,
      rules: [{ actionOrdinal: 1, attemptNumber: 1, phase: "AFTER_WRITE", fault: "TIMEOUT" }]
    }
  },
  {
    id: "partial-reserve-success-inspection-timeout-before",
    name: "Partial completion",
    description: "Reserve succeeds; inspection attempt times out before write and is retried alone.",
    config: {
      seed: 4,
      rules: [{ actionOrdinal: 2, attemptNumber: 1, phase: "BEFORE_WRITE", fault: "TIMEOUT" }]
    }
  },
  {
    id: "stale-version-before-second-action",
    name: "Stale version before second action",
    description: "An external actor bumps claim version after reserve and before inspection.",
    config: {
      seed: 5,
      rules: [
        {
          actionOrdinal: 2,
          attemptNumber: 1,
          phase: "BEFORE_WRITE",
          fault: "EXTERNAL_VERSION_BUMP"
        }
      ]
    }
  },
  {
    id: "malformed-response-after-write-reserve",
    name: "Malformed response after write",
    description: "The mutation commits but the adapter response body is unusable.",
    config: {
      seed: 6,
      rules: [
        {
          actionOrdinal: 1,
          attemptNumber: 1,
          phase: "AFTER_WRITE",
          fault: "MALFORMED_RESPONSE"
        }
      ]
    }
  },
  {
    id: "ambiguous-write-and-readback-timeout",
    name: "Ambiguous write and read-back timeout",
    description: "Settlement write may have committed, response times out, and read-back fails.",
    config: {
      seed: 7,
      rules: [
        { actionOrdinal: 1, attemptNumber: 1, phase: "AFTER_WRITE", fault: "TIMEOUT" },
        { actionOrdinal: 1, attemptNumber: 1, phase: "READBACK", fault: "TIMEOUT" }
      ]
    }
  },
  {
    id: "retry-exhaustion-inspection",
    name: "Retry exhaustion",
    description: "Inspection times out before write on every allowed attempt.",
    config: {
      seed: 8,
      rules: [
        { actionOrdinal: 1, attemptNumber: 1, phase: "BEFORE_WRITE", fault: "TRANSIENT_ERROR" },
        { actionOrdinal: 1, attemptNumber: 2, phase: "BEFORE_WRITE", fault: "TRANSIENT_ERROR" },
        { actionOrdinal: 1, attemptNumber: 3, phase: "BEFORE_WRITE", fault: "TRANSIENT_ERROR" }
      ]
    }
  }
];

export function getSeededFaultProfile(id?: string | null): SeededFaultProfile {
  return seededFaultProfiles.find((profile) => profile.id === (id ?? "none")) ?? seededFaultProfiles[0];
}
