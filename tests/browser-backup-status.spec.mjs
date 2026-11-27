import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:4173";
test.beforeEach(async ({ request, context }) => {
  const { cookie } = await (await request.post("/__test__/reset")).json(), at = cookie.indexOf("=");
  await context.addCookies([{ name: cookie.slice(0, at), value: cookie.slice(at + 1), url: origin, httpOnly: true, sameSite: "Strict" }]);
});

test("settings show the real nightly result with explicit coverage and Workshop export guidance", async ({ page }, testInfo) => {
  await page.goto("/project.html");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).fill("Nightly backup fixture");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const run = await page.request.post("/__test__/nightly-backup"); expect(run.ok(), await run.text()).toBe(true);
  await page.goto("/website-settings.html");
  const backup = page.locator('[data-section="website-backup"]');
  await backup.locator('[data-section="project-backup-checks"] > summary').click();
  await expect(backup.getByText("Nightly project backup: OK", { exact: true })).toBeVisible();
  await expect(backup).toContainText("1 saved · 0 unchanged · 0 failed");
  await expect(backup).toContainText("backups cover Projects only");
  await expect(backup).toContainText("Lessons Learned");
  await expect(backup).toContainText("same Cloudflare account");
  const status = await (await page.request.get("/api/backup-status")).json();
  expect(status.lastSuccess.id).toBe(status.lastAttempt.id);
  await page.screenshot({ path: testInfo.outputPath("backup-status-ok.png"), fullPage: true });
  await page.goto("/workshop.html");
  await page.getByRole("button", { name: "About Workshop export", exact: true }).click();
  const help = page.getByRole("tooltip");
  await expect(help).toContainText("Projects and Lessons Learned are not included");
  await expect(help).toContainText("Website settings → Data backup → Backup all data");
});

for (const width of [390, 1440]) test("unavailable or failed backup status cannot imply protection or discard settings at " + width, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 950 });
  let unavailable = true;
  const success = { id: crypto.randomUUID(), state: "success", scheduledFor: "2026-11-26T09:17:00.000Z", startedAt: "2026-11-26T09:17:00.000Z", finishedAt: "2026-11-26T09:18:00.000Z", counts: { saved: 1, unchanged: 0, failed: 0, deleted: 0 } };
  await page.route("**/api/backup-status", route => route.fulfill(unavailable ? { status: 503, json: { error: "Storage unavailable" } } : { json: { health: "failed", lastAttempt: { ...success, id: crypto.randomUUID(), state: "failed", startedAt: "2026-11-27T09:17:00.000Z", finishedAt: "2026-11-27T09:18:00.000Z", counts: { saved: 0, unchanged: 0, failed: 1, deleted: 0 } }, lastSuccess: success } }));
  await page.goto("/website-settings.html");
  const backup = page.locator('[data-section="website-backup"]');
  await backup.locator('[data-section="project-backup-checks"] > summary').click();
  await expect(backup).toContainText("Protection is unconfirmed");
  const owner = page.getByLabel("Owner 1", { exact: true }); await owner.fill("Unsent owner name");
  unavailable = false;
  await backup.getByRole("button", { name: "Refresh backup status", exact: true }).click();
  await expect(backup).toContainText("Nightly project backup failed");
  await expect(backup).toContainText("Nov 26, 2026");
  await expect(backup).toContainText("0 saved · 0 unchanged · 1 failed");
  await expect(owner).toHaveValue("Unsent owner name");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await backup.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("backup-status-failed.png"), fullPage: true });
});
