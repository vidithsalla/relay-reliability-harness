import { pool } from "@/lib/db/client";
import { demoClaimId } from "@/lib/demo/ids";
import type { SeededFaultProfile } from "@/lib/fixtures/fault-profiles";

type ClaimFixture = {
  id: string;
  status: "OPEN" | "NEGOTIATING" | "CLOSED";
  claimantName: string;
  lossType: string;
  reserveAmountCents: number;
  estimatedLossCents: number | null;
  version: number;
};

const claimFixtures: Record<string, ClaimFixture> = {
  "CLM-1042": {
    id: "CLM-1042",
    status: "OPEN",
    claimantName: "Alex Morgan",
    lossType: "AUTO_COLLISION",
    reserveAmountCents: 500000,
    estimatedLossCents: 840000,
    version: 17
  },
  "CLM-2048": {
    id: "CLM-2048",
    status: "NEGOTIATING",
    claimantName: "Jordan Blake",
    lossType: "COMMERCIAL_PROPERTY",
    reserveAmountCents: 5000000,
    estimatedLossCents: 4250000,
    version: 9
  },
  "CLM-3001": {
    id: "CLM-3001",
    status: "CLOSED",
    claimantName: "Taylor Reed",
    lossType: "AUTO_GLASS",
    reserveAmountCents: 0,
    estimatedLossCents: null,
    version: 31
  }
};

export async function resetClaimFixtures(claimIds: string[]): Promise<void> {
  await resetClaimRows(claimIds.map((claimId) => fixtureForClaim(claimId, claimId)));
}

export async function resetDemoClaimFixture(baseClaimId: string, demoSessionId: string): Promise<string> {
  const claimId = demoClaimId(baseClaimId, demoSessionId);
  await resetClaimRows([fixtureForClaim(baseClaimId, claimId)]);
  return claimId;
}

async function resetClaimRows(fixtures: ClaimFixture[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const fixture of fixtures) {
      const claimId = fixture.id;
      await client.query("DELETE FROM enterprise_idempotency_ledger WHERE claim_id = $1", [claimId]);
      await client.query("DELETE FROM claim_notes WHERE claim_id = $1", [claimId]);
      await client.query("DELETE FROM claim_settlements WHERE claim_id = $1", [claimId]);
      await client.query("DELETE FROM claim_inspections WHERE claim_id = $1", [claimId]);
      await client.query(
        `
          INSERT INTO claims (
            id, status, claimant_name, loss_type, reserve_amount_cents, estimated_loss_cents, version, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, now())
          ON CONFLICT (id) DO UPDATE SET
            status = excluded.status,
            claimant_name = excluded.claimant_name,
            loss_type = excluded.loss_type,
            reserve_amount_cents = excluded.reserve_amount_cents,
            estimated_loss_cents = excluded.estimated_loss_cents,
            version = excluded.version,
            updated_at = now()
        `,
        [
          fixture.id,
          fixture.status,
          fixture.claimantName,
          fixture.lossType,
          fixture.reserveAmountCents,
          fixture.estimatedLossCents,
          fixture.version
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function fixtureForClaim(baseClaimId: string, claimId: string): ClaimFixture {
  const fixture = claimFixtures[baseClaimId];
  if (!fixture) {
    throw new Error(`Unknown fixture claim ${baseClaimId}`);
  }
  return { ...fixture, id: claimId };
}

export async function seedFaultProfiles(profiles: SeededFaultProfile[]): Promise<void> {
  for (const profile of profiles) {
    await pool.query(
      `
        INSERT INTO fault_profiles (id, name, description, config_json, is_seeded)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          config_json = excluded.config_json,
          is_seeded = true
      `,
      [profile.id, profile.name, profile.description, JSON.stringify(profile.config)]
    );
  }
}

export async function bumpClaimVersion(claimId: string): Promise<number> {
  const result = await pool.query<{ version: number }>(
    "UPDATE claims SET version = version + 1, updated_at = now() WHERE id = $1 RETURNING version",
    [claimId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error(`Claim ${claimId} not found`);
  }
  return row.version;
}
