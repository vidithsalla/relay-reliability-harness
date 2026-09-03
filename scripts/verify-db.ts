import { Pool } from "pg";

import { pool } from "@/lib/db/client";
import { resetClaimFixtures } from "@/lib/services/seed-service";
import { createAndStartRun } from "@/lib/services/run-service";

async function main() {
  await resetClaimFixtures(["CLM-1042"]);
  const run = await createAndStartRun({
    claimId: "CLM-1042",
    requestText:
      "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
    plannerMode: "deterministic",
    faultProfileId: "timeout-after-write-reserve",
    scenarioId: "verify-db"
  });
  const fresh = new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://relay:relay@localhost:5432/relay"
  });
  try {
    const persisted = await fresh.query(
      `
        SELECT
          (SELECT count(*) FROM workflow_runs WHERE id = $1)::int AS runs,
          (SELECT count(*) FROM planned_actions pa JOIN action_plans ap ON ap.id = pa.plan_id WHERE ap.run_id = $1)::int AS actions,
          (SELECT count(*) FROM action_attempts aa JOIN planned_actions pa ON pa.id = aa.planned_action_id JOIN action_plans ap ON ap.id = pa.plan_id WHERE ap.run_id = $1)::int AS attempts,
          (SELECT count(*) FROM reconciliations r JOIN action_attempts aa ON aa.id = r.attempt_id JOIN planned_actions pa ON pa.id = aa.planned_action_id JOIN action_plans ap ON ap.id = pa.plan_id WHERE ap.run_id = $1)::int AS reconciliations,
          (SELECT count(*) FROM trace_events WHERE run_id = $1)::int AS trace_events,
          (SELECT reserve_amount_cents FROM claims WHERE id = 'CLM-1042')::bigint AS reserve
      `,
      [run.runId]
    );
    const row = persisted.rows[0];
    const ok =
      row.runs === 1 &&
      row.actions === 2 &&
      row.attempts >= 2 &&
      row.reconciliations >= 2 &&
      row.trace_events >= 8 &&
      Number(row.reserve) === 840000;
    if (!ok) {
      throw new Error(`Persistence verification failed: ${JSON.stringify(row)}`);
    }
    console.log(`verify:db PASS run=${run.runId} status=${run.status}`);
  } finally {
    await fresh.end();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
