import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const origin = "http://127.0.0.1:4173";
test.beforeEach(async ({ request, context }) => {
  const { cookie } = await (await request.post("/__test__/reset")).json(),
    at = cookie.indexOf("=");
  await context.addCookies([
    {
      name: cookie.slice(0, at),
      value: cookie.slice(at + 1),
      url: origin,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
});
for (const width of [390, 1440])
  test(
    "nightly whole-site copies capture notebook-only edits and download valid backups at " +
      width,
    async ({ page }, testInfo) => {
      await page.addInitScript(() => { window.showSaveFilePicker = undefined; });
      await page.setViewportSize({ width, height: 950 });
      const id = crypto.randomUUID();
      const post = async (body) => {
        const response = await page.request.post("/api/lessons-learned", {
          headers: { origin },
          data: body,
        });
        expect(response.ok(), await response.text()).toBe(true);
      };
      const record = {
        id,
        happened: "A notebook-only backup",
        steps: [],
        resolution: { text: "Captured without a project edit", quality: "yes" },
      };
      await post({
        record,
        expectedRevision: null,
        operationId: crypto.randomUUID(),
      });
      let response = await page.request.post("/__test__/nightly-backup");
      expect(response.ok(), await response.text()).toBe(true);
      record.happened = "A second notebook-only change";
      await post({
        record,
        expectedRevision: 1,
        operationId: crypto.randomUUID(),
      });
      response = await page.request.post("/__test__/nightly-backup");
      expect(response.ok(), await response.text()).toBe(true);
      await page.goto("/website-settings.html");
      const status = page.locator("[data-site-backups]");
      await expect(
        status.getByText("Nightly whole-site backup: OK", { exact: true }),
      ).toBeVisible();
      await expect(
        status.getByRole("link", { name: /Download whole-site backup from/ }),
      ).toHaveCount(2);
      await expect(
        page.locator('[data-section="project-backup-checks"]'),
      ).not.toHaveAttribute("open");
      const downloadEvent = page.waitForEvent("download");
      await status
        .getByRole("link", { name: /Download whole-site backup from/ })
        .first()
        .click();
      const download = await downloadEvent,
        path = await download.path();
      const reminder = await (await page.request.get("/api/project-engine/backup-reminder")).json();
      expect(reminder.lastDownloaded).toBeNull();
      expect(reminder.lastConfirmed).toBeNull();
      expect(download.suggestedFilename()).toMatch(/\.bsbackup$/);
      const verified = spawnSync(
        "python",
        ["scripts/verify-site-backup.py", path],
        { encoding: "utf8" },
      );
      expect(verified.status, verified.stderr).toBe(0);
      const entries = readFileSync(path, "utf8")
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(entries[0].excludedPrefixes).toEqual(["automatic-backups/"]);
      expect(
        entries.some(
          (e) =>
            e.type === "row" &&
            e.value.happened === "A second notebook-only change",
        ),
      ).toBe(true);
      expect(
        entries.some(
          (e) => e.type === "object" && e.key.startsWith("automatic-backups/"),
        ),
      ).toBe(false);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .locator('[data-section="website-backup"]')
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath("automatic-whole-site-backups.png"),
        fullPage: true,
      });
    },
  );
