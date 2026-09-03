import { mkdir } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

import { runEvalSuite } from "@/lib/eval/eval-suite";
import { resetClaimFixtures } from "@/lib/services/seed-service";
import { createAndStartRun } from "@/lib/services/run-service";
import { pool } from "@/lib/db/client";

const port = 3011;
const baseUrl = `http://127.0.0.1:${port}`;
const screenshotDir = path.join(process.cwd(), "docs", "screenshots");

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  await resetClaimFixtures(["CLM-1042", "CLM-2048"]);
  const timeout = await createAndStartRun({
    claimId: "CLM-1042",
    requestText:
      "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
    plannerMode: "deterministic",
    faultProfileId: "timeout-after-write-reserve",
    scenarioId: "screenshot-timeout-after"
  });
  await resetClaimFixtures(["CLM-1042"]);
  const partial = await createAndStartRun({
    claimId: "CLM-1042",
    requestText:
      "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
    plannerMode: "deterministic",
    faultProfileId: "partial-reserve-success-inspection-timeout-before",
    scenarioId: "screenshot-partial"
  });
  await resetClaimFixtures(["CLM-1042"]);
  const stale = await createAndStartRun({
    claimId: "CLM-1042",
    requestText:
      "The repair estimate came back at $8,400. Update the reserve and schedule an inspection with Preferred Body Network.",
    plannerMode: "deterministic",
    faultProfileId: "stale-version-before-second-action",
    scenarioId: "screenshot-stale"
  });
  await resetClaimFixtures(["CLM-2048"]);
  await createAndStartRun({
    claimId: "CLM-2048",
    requestText: "Issue the agreed $42,500 settlement.",
    plannerMode: "deterministic",
    faultProfileId: "none",
    scenarioId: "screenshot-review"
  });
  await runEvalSuite();

  const server = spawn("npx", ["next", "dev", "-p", String(port)], {
    stdio: "ignore",
    env: { ...process.env, FORCE_COLOR: "0" }
  });
  try {
    await waitForServer();
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await screenshot(page, "/", "01-scenario-launcher.png");
    await screenshot(page, `/runs/${timeout.runId}`, "02-timeout-after-write.png");
    await screenshot(page, `/runs/${partial.runId}`, "03-partial-completion.png");
    await screenshot(page, `/runs/${stale.runId}`, "04-stale-version.png");
    await screenshot(page, "/review", "05-review-queue.png");
    await screenshot(page, "/evals", "06-eval-results.png");
    await browser.close();
  } finally {
    stop(server);
    await pool.end();
  }
}

async function screenshot(page: Page, url: string, file: string) {
  await page.goto(`${baseUrl}${url}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(screenshotDir, file), fullPage: true });
  console.log(`captured docs/screenshots/${file}`);
}

async function waitForServer() {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("Timed out waiting for screenshot server.");
}

function stop(server: ChildProcess) {
  if (!server.killed) {
    server.kill("SIGTERM");
  }
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
