import { beforeEach, describe, expect, it } from "vitest";

import { ClaimsEnterpriseAdapter } from "@/lib/adapters/claims-adapter";
import { EnterpriseError, EnterpriseVersionConflictError } from "@/lib/domain/errors";
import { resetClaimFixtures } from "@/lib/services/seed-service";

describe("claims source-of-record adapter", () => {
  const adapter = new ClaimsEnterpriseAdapter();

  beforeEach(async () => {
    await resetClaimFixtures(["CLM-1042"]);
  });

  it("applies expected-version reserve mutation atomically", async () => {
    const result = await adapter.setReserve(
      { claimId: "CLM-1042", reserveAmountCents: 840000 },
      { expectedVersion: 17, idempotencyKey: "it-reserve", attemptNumber: 1 }
    );
    const claim = await adapter.getClaim("CLM-1042");
    expect(result.transportStatus).toBe("SUCCESS_RESPONSE");
    expect(claim.reserveAmountCents).toBe(840000);
    expect(claim.version).toBe(18);
  });

  it("rejects stale expected versions", async () => {
    await expect(
      adapter.setReserve(
        { claimId: "CLM-1042", reserveAmountCents: 840000 },
        { expectedVersion: 16, idempotencyKey: "it-conflict", attemptNumber: 1 }
      )
    ).rejects.toBeInstanceOf(EnterpriseVersionConflictError);
  });

  it("returns idempotent replay without duplicate child effects", async () => {
    await adapter.scheduleInspection(
      { claimId: "CLM-1042", network: "Preferred Body Network" },
      { expectedVersion: 17, idempotencyKey: "it-inspection", attemptNumber: 1 }
    );
    const replay = await adapter.scheduleInspection(
      { claimId: "CLM-1042", network: "Preferred Body Network" },
      { expectedVersion: 17, idempotencyKey: "it-inspection", attemptNumber: 2 }
    );
    const claim = await adapter.getClaim("CLM-1042");
    expect(replay.transportStatus).toBe("IDEMPOTENT_REPLAY");
    expect(claim.inspections).toHaveLength(1);
  });

  it("fails closed when an idempotency key is reused for different input", async () => {
    await adapter.scheduleInspection(
      { claimId: "CLM-1042", network: "Preferred Body Network" },
      { expectedVersion: 17, idempotencyKey: "it-key-conflict", attemptNumber: 1 }
    );
    await expect(
      adapter.scheduleInspection(
        { claimId: "CLM-1042", network: "Other Network" },
        { expectedVersion: 18, idempotencyKey: "it-key-conflict", attemptNumber: 2 }
      )
    ).rejects.toBeInstanceOf(EnterpriseError);
  });
});
