import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:4173";
for (const width of [1440, 390])
  test(
    "one account menu shares settings, keyboard controls and outside dismissal at " +
      width +
      "px",
    async ({ page, request, context }) => {
      const { cookie } = await (
          await request.post("/__test__/reset?engine=1")
        ).json(),
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
      await page.setViewportSize({ width, height: 1000 });
      for (const path of [
        "/project.html",
        "/workshop.html",
        "/knowledge.html",
        "/calculators.html",
        "/website-settings.html",
      ]) {
        await page.goto(path);
        const trigger = page.locator(".ui-site-account");
        await expect(trigger).toHaveCount(1);
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
        await expect(page.locator(".ui-site-settings")).toHaveCount(0);
        await trigger.focus();
        await trigger.press("ArrowDown");
        let menu = page.getByRole("menu", {
          name: "Account menu",
          exact: true,
        });
        await expect(menu).toBeVisible();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        await expect(menu.getByRole("menuitem").first()).toBeFocused();
        await menu.getByRole("menuitem").first().press("ArrowDown");
        await expect(
          menu.getByRole("menuitem", { name: "Website settings", exact: true }),
        ).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(menu).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await trigger.click();
        await expect(menu).toBeVisible();
        await trigger.click();
        await expect(menu).toHaveCount(0);
        await trigger.click();
        await page.locator("h1").first().click();
        await expect(menu).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        ).toBeLessThanOrEqual(0);
      }
      await page.goto("/project.html");
      await expect(
        page.locator("summary").filter({ hasText: "Restore project backup" }),
      ).toHaveCount(0);
      await page.locator(".ui-site-account").click();
      await page
        .getByRole("menuitem", { name: "Website settings", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Website settings", exact: true }),
      ).toBeVisible();
      await expect(
        page.locator('[data-section="website-project-restore"]'),
      ).toBeVisible();
    },
  );
