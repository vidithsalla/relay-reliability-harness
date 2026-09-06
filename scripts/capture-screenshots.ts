import { mkdir } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

import { runEvalSuite } from "@/lib/eval/eval-suite";
import { createDemoSessionId, DEMO_SESSION_COOKIE } from "@/lib/demo/ids";
import { runDemoScenario } from "@/lib/services/demo-scenario-service";
import { pool } from "@/lib/db/client";

const port = 3011;
const baseUrl = `http://127.0.0.1:${port}`;
const screenshotDir = path.join(process.cwd(), "docs", "screenshots");

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const timeoutBeforeSession = createDemoSessionId();
  const timeoutSession = createDemoSessionId();
  const partialSession = createDemoSessionId();
  const staleSession = createDemoSessionId();
  const duplicateSession = createDemoSessionId();
  const retrySession = createDemoSessionId();
  const ambiguousSession = createDemoSessionId();
  const reviewSession = createDemoSessionId();
  const timeoutBefore = await runDemoScenario("timeout-before-write", timeoutBeforeSession);
  const timeout = await runDemoScenario("timeout-after-write", timeoutSession);
  const partial = await runDemoScenario("partial-completion", partialSession);
  const stale = await runDemoScenario("stale-state", staleSession);
  const duplicate = await runDemoScenario("duplicate-request", duplicateSession);
  const retryExhaustion = await runDemoScenario("retry-exhaustion", retrySession);
  const ambiguous = await runDemoScenario("ambiguous-outcome", ambiguousSession);
  await runDemoScenario("high-risk-settlement", reviewSession);
  await runEvalSuite();

  const server = spawn("npx", ["next", "dev", "-p", String(port)], {
    stdio: "ignore",
    env: { ...process.env, FORCE_COLOR: "0" }
  });
  try {
    await waitForServer();
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await screenshot(page, "/", "00-homepage.png");
    await screenshot(page, "/scenarios", "01-scenario-launcher.png");
    await screenshot(page, `/runs/${timeout.runId}`, "02-timeout-after-write.png", timeoutSession);
    await screenshot(page, `/runs/${timeoutBefore.runId}`, "03-timeout-before-write.png", timeoutBeforeSession);
    await screenshot(page, `/runs/${partial.runId}`, "04-partial-completion.png", partialSession);
    await screenshot(page, `/runs/${stale.runId}`, "05-stale-version.png", staleSession);
    await screenshot(page, `/runs/${duplicate.runId}`, "06-duplicate-request.png", duplicateSession);
    await screenshot(page, `/runs/${retryExhaustion.runId}`, "07-retry-exhaustion.png", retrySession);
    await screenshot(page, `/runs/${ambiguous.runId}`, "08-ambiguous-investigation.png", ambiguousSession);
    await screenshot(page, "/review", "09-review-queue.png", reviewSession);
    await screenshot(page, "/evals", "10-eval-results.png");
    await browser.close();
  } finally {
    stop(server);
    await pool.end();
  }
}

async function screenshot(page: Page, url: string, file: string, demoSessionId?: string) {
  if (demoSessionId) {
    await page.context().addCookies([
      {
        name: DEMO_SESSION_COOKIE,
        value: demoSessionId,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Lax"
      }
    ]);
  }
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
