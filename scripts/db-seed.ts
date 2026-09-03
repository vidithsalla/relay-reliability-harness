import { seededFaultProfiles } from "@/lib/fixtures/fault-profiles";
import { resetClaimFixtures, seedFaultProfiles } from "@/lib/services/seed-service";
import { pool } from "@/lib/db/client";

async function main() {
  await resetClaimFixtures(["CLM-1042", "CLM-2048", "CLM-3001"]);
  await seedFaultProfiles(seededFaultProfiles);
  console.log("seeded synthetic claims and fault profiles");
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
