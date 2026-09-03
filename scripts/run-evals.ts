import { runEvalSuite } from "@/lib/eval/eval-suite";
import { pool } from "@/lib/db/client";

async function main() {
  const result = await runEvalSuite();
  for (const row of result.results) {
    console.log(`${row.caseId.padEnd(42)} ${row.passed ? "PASS" : "FAIL"}`);
    if (!row.passed) {
      console.log(`  ${row.failureSummary}`);
    }
  }
  console.log(`${result.passed}/${result.results.length} passed`);
  if (result.failed > 0) {
    process.exitCode = 1;
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
