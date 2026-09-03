import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.beforeEach(() => {
  execFileSync("npm", ["run", "db:reset"], { stdio: "inherit" });
});

test("timeout-after-write shows transport failure but confirmed business success", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await scenarioCard(page, "Timeout after write").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByRole("heading", { name: /Reliability Trace/ })).toBeVisible();
  await expect(page.getByText("Timeout", { exact: true })).toBeVisible();
  await expect(page.getByText("Confirmed Applied").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Confirmed Applied").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("partial completion retries only the missing inspection", async ({ page }) => {
  await page.goto("/");
  await scenarioCard(page, "Partial completion").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByRole("heading", { name: /Reliability Trace/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Set reserve.*1/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Schedule inspection.*2/ })).toBeVisible();
});

test("stale version scenario shows replan blocker", async ({ page }) => {
  await page.goto("/");
  await scenarioCard(page, "Stale state").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByText("Replan Required").first()).toBeVisible();
  await expect(page.getByText(/Version chain conflict|version conflict/i)).toBeVisible();
});

test("high-risk settlement review approves and persists settlement", async ({ page }) => {
  await page.goto("/");
  await scenarioCard(page, "High-risk settlement").getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByText("Waiting Review").first()).toBeVisible();
  await page.goto("/review");
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByText("Completed").first()).toBeVisible();
  await expect(page.getByText("settlements 1")).toBeVisible();
});

test("evals page reflects persisted latest eval results", async ({ page }) => {
  await page.goto("/evals");
  await page.getByRole("button", { name: "Run eval suite" }).click();
  await expect(page.getByRole("heading", { name: /Latest suite: 12\/12 passed/ })).toBeVisible({ timeout: 30000 });
});

function scenarioCard(page: import("@playwright/test").Page, title: string) {
  return page.locator("article").filter({ has: page.getByRole("heading", { name: title }) });
}
