import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.beforeEach(() => {
  execFileSync("npm", ["run", "db:reset"], { stdio: "inherit" });
});

test("homepage explains Relay and launches the strongest demo", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "An AI agent makes a change. The API times out. What actually happened?" })
  ).toBeVisible();
  await expect(page.getByText("Did it fail, succeed without returning a response")).toBeVisible();
  await expect(page.getByText("Relay sits between that failure and the retry.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "How Relay works" })).toBeVisible();
  await expect(page.getByText("The uncertainty gap")).toBeVisible();
  await expect(page.getByText("The response cannot tell us.")).toBeVisible();
  await expect(page.getByText("Reserve = $8,400")).toBeVisible();
  await expect(page.getByText("Do not retry").first()).toBeVisible();
  await expect(page.getByText("Relay caught the difference before another write could run.")).toBeVisible();
  await page.getByRole("link", { name: "See how Relay handles failures" }).click();
  await expect(page).toHaveURL(/#proof$/);
  await expect(page.getByRole("heading", { name: "See the proof" })).toBeVisible();
  const proof = page.locator(".proof-section");
  await expect(proof.getByRole("button", { name: /Run a failure/ })).toBeVisible();
  await expect(proof.getByRole("link", { name: /Inspect a trace/ })).toBeVisible();
  await expect(proof.getByRole("link", { name: /View the evals/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Under the hood" })).toBeVisible();
  await expect(page.getByText("The planner proposes intent. Deterministic software owns execution safety.")).toBeVisible();
  await proof.getByRole("button", { name: /Run a failure/ }).click();
  await expect(page.getByRole("heading", { name: /Execution Trace/ })).toBeVisible();
  await expect(page.getByText("Timeout", { exact: true })).toBeVisible();
  await expect(page.getByText("Confirmed Applied").first()).toBeVisible();
});

test("homepage proof gateway links to traces and evals", async ({ page }) => {
  await page.goto("/");
  const proof = page.locator(".proof-section");
  await proof.getByRole("link", { name: /Inspect a trace/ }).click();
  await expect(page).toHaveURL(/\/runs$/);
  await expect(page.getByRole("heading", { name: "Execution traces" })).toBeVisible();

  await page.goto("/");
  await page.locator(".proof-section").getByRole("link", { name: /View the evals/ }).click();
  await expect(page).toHaveURL(/\/evals$/);
  await expect(page.getByRole("heading", { name: "Reliability evals" })).toBeVisible();
});

test("homepage secondary CTA routes to scenarios", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explore all scenarios" }).first().click();
  await expect(page).toHaveURL(/\/scenarios$/);
  await expect(page.getByRole("heading", { name: "Scenarios" })).toBeVisible();
});

test("primary navigation keeps home and scenarios separate", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Traces" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Review Queue" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Evals" })).toBeVisible();
  await nav.getByRole("link", { name: "Scenarios" }).click();
  await expect(page).toHaveURL(/\/scenarios$/);
  await expect(page.getByRole("heading", { name: "Scenarios" })).toBeVisible();
  await page.getByRole("link", { name: "Relay" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "An AI agent makes a change. The API times out. What actually happened?" })
  ).toBeVisible();
});

test("happy path scenario launches from scenarios", async ({ page }) => {
  await page.goto("/scenarios");
  await scenarioCard(page, "Happy path").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByRole("heading", { name: /Execution Trace/ })).toBeVisible();
  await expect(page.getByText("Completed").first()).toBeVisible();
  await expect(page.getByText("Confirmed Applied").first()).toBeVisible();
});

test("timeout-after-write shows transport failure but confirmed business success", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/scenarios");
  await scenarioCard(page, "Timeout after write").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByRole("heading", { name: /Execution Trace/ })).toBeVisible();
  await expect(page.getByText("Timeout", { exact: true })).toBeVisible();
  await expect(page.getByText("Confirmed Applied").first()).toBeVisible();
  await expect(page.getByText("The planner proposed intent.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Confirmed Applied").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("timeout-before-write proves absence before retrying", async ({ page }) => {
  await page.goto("/scenarios");
  await scenarioCard(page, "Timeout before write").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByRole("heading", { name: /Execution Trace/ })).toBeVisible();
  await expect(page.getByText("Retried after absence was proven")).toBeVisible();
  await expect(page.getByText("reserve $5,000 in source of record")).toBeVisible();
  await expect(page.getByText("Timeout -> Success Response")).toBeVisible();
});

test("partial completion retries only the missing inspection", async ({ page }) => {
  await page.goto("/scenarios");
  await scenarioCard(page, "Partial completion").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByRole("heading", { name: /Execution Trace/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Set reserve.*1/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Schedule inspection.*2/ })).toBeVisible();
});

test("stale version scenario shows replan blocker", async ({ page }) => {
  await page.goto("/scenarios");
  await scenarioCard(page, "Stale state").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByText("Replan Required").first()).toBeVisible();
  await expect(page.getByText("SCHEDULE_INSPECTION -> Version Conflict")).toBeVisible();
});

test("duplicate request is a no-op idempotent replay", async ({ page }) => {
  await page.goto("/scenarios");
  await scenarioCard(page, "Duplicate request").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByText("No Op Duplicate").first()).toBeVisible();
  await expect(page.getByText("No-op duplicate: prior effect reused")).toBeVisible();
  await expect(page.getByText("Idempotent Replay").first()).toBeVisible();
});

test("retry exhaustion stops in manual investigation", async ({ page }) => {
  await page.goto("/scenarios");
  await scenarioCard(page, "Retry exhaustion").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByText("Retry limit reached: manual investigation")).toBeVisible();
  await expect(page.getByText("Manual Investigation Required").first()).toBeVisible();
  await expect(page.getByText("Transient Error -> Transient Error -> Transient Error")).toBeVisible();
});

test("ambiguous state requires manual investigation without blind retry", async ({ page }) => {
  await page.goto("/scenarios");
  await scenarioCard(page, "Ambiguous outcome").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByText("No blind retry: manual investigation")).toBeVisible();
  await expect(page.getByText("Authoritative read-back failed").first()).toBeVisible();
  await expect(page.getByText("Unknown").first()).toBeVisible();
});

test("high-risk settlement review approves and persists settlement", async ({ page }) => {
  await page.goto("/scenarios");
  await scenarioCard(page, "High-risk settlement").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByText("Waiting Review").first()).toBeVisible();
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByText("Completed").first()).toBeVisible();
  await expect(page.getByText("settlements 1 in source of record")).toBeVisible();
});

test("reviewer rejection fails closed without an adapter attempt", async ({ page }) => {
  await page.goto("/scenarios");
  await scenarioCard(page, "High-risk settlement").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByText("Waiting Review").first()).toBeVisible();
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();
  await page.getByRole("button", { name: "Reject" }).first().click();
  await expect(page.getByText("Failed Closed").first()).toBeVisible();
  await expect(page.getByText("Rejected").first()).toBeVisible();
  await expect(page.getByText("No adapter call was made.").first()).toBeVisible();
});

test("evals page reflects persisted latest eval results", async ({ page }) => {
  await page.goto("/evals");
  await page.getByRole("button", { name: "Run eval suite" }).click();
  await expect(page.getByRole("heading", { name: /Latest suite: 12\/12 passed/ })).toBeVisible({ timeout: 30000 });
});

function scenarioCard(page: import("@playwright/test").Page, title: string) {
  return page.locator("article").filter({ has: page.getByRole("heading", { name: title }) });
}
