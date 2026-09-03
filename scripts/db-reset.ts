import { pool } from "@/lib/db/client";

const tables = [
  "eval_case_results",
  "eval_runs",
  "trace_events",
  "review_requests",
  "recovery_decisions",
  "reconciliations",
  "state_snapshots",
  "action_attempts",
  "planned_actions",
  "action_plans",
  "workflow_runs",
  "enterprise_idempotency_ledger",
  "claim_notes",
  "claim_settlements",
  "claim_inspections",
  "fault_profiles",
  "claims"
];

async function main() {
  await pool.query(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
  console.log("reset local synthetic Relay data");
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
