import { test, expect } from "@playwright/test";
for (const path of [
  "/calculators.html",
  "/knowledge.html#calculators",
  "/index.html#calculators",
])
  for (const width of [390, 1440])
    test(
      "wire calculator modes, validation and gauge selection on " +
        path +
        " at " +
        width,
      async ({ page, request, context }, testInfo) => {
        const { cookie } = await (
            await request.post("/__test__/reset?engine=1")
          ).json(),
          at = cookie.indexOf("=");
        await context.addCookies([
          {
            name: cookie.slice(0, at),
            value: cookie.slice(at + 1),
            url: "http://127.0.0.1:4173",
            httpOnly: true,
            sameSite: "Strict",
          },
        ]);
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(path);
        const root = page.locator("#resource-calculators");
        await root
          .getByRole("searchbox", { name: "Search calculators", exact: true })
          .fill("shunt");
        await root
          .getByRole("button", { name: "Open Wire resistance", exact: true })
          .click();
        const tool = root.locator(".wire-calculator");
        await expect(tool.locator('[data-wire="big"]')).toHaveText("1.89 m");
        await expect(tool.locator("#wire-lengthRow")).toBeHidden();
        await expect(tool.locator("#wire-rhoBox")).toBeHidden();
        await expect(tool.locator("#wire-mmBox")).toBeHidden();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        ).toBe(0);
        await page.screenshot({
          path: testInfo.outputPath("wire-calculator.png"),
          fullPage: true,
        });
        await tool.getByLabel("Load given as").selectOption("current");
        await tool.getByLabel("Current (A)", { exact: true }).fill("2");
        await expect(tool.locator('[data-wire="facts"]')).toContainText("2 A");
        await tool
          .getByRole("button", { name: "Resistance of a length", exact: true })
          .click();
        await expect(tool.locator("#wire-targetRow")).toBeHidden();
        await expect(tool.locator("#wire-lengthRow")).toBeVisible();
        await tool.getByLabel("Wire length", { exact: true }).fill("1");
        await tool.getByLabel("Unit", { exact: true }).selectOption("0.3048");
        await expect(tool.locator('[data-wire="big"]')).toHaveText("16.1 mΩ");
        await tool.getByLabel("Wire size", { exact: true }).selectOption("mm");
        await expect(tool.locator("#wire-awgBox")).toBeHidden();
        await tool.getByLabel("Diameter (mm)", { exact: true }).fill("1");
        await tool
          .getByLabel("Material", { exact: true })
          .selectOption("custom");
        await tool
          .getByLabel("Resistivity at 20 °C (Ω·m)", { exact: true })
          .fill("0.000001");
        await expect(tool.locator('[data-wire="big"]')).toHaveText("388 mΩ");
        await tool
          .getByRole("button", { name: "Use 18 AWG", exact: true })
          .focus();
        await page.keyboard.press("Enter");
        await expect(tool.getByLabel("Gauge", { exact: true })).toHaveValue(
          "18",
        );
        await expect(tool.getByLabel("Gauge", { exact: true })).toBeFocused();
        await tool.getByLabel("Wire length", { exact: true }).fill("");
        await expect(tool.locator('[data-wire="big"]')).toHaveText("—");
        await expect(tool.locator('[data-wire="heat"]')).toBeHidden();
        await expect(tool.locator('[data-wire="rows"] tr')).toHaveCount(0);
        await expect(tool.locator('[data-wire="sub"]')).toHaveText(
          "Enter a wire length greater than zero.",
        );
        await tool.getByLabel("Wire length", { exact: true }).fill("1");
        await tool.getByLabel("Current (A)", { exact: true }).fill("100000000");
        await expect(tool.locator('[data-wire="temperature"]')).toHaveText(
          "Outside the heat model's range",
        );
        await root
          .getByRole("button", { name: "Back to calculators", exact: true })
          .click();
        await root
          .getByRole("button", { name: "Open Wire resistance", exact: true })
          .click();
        await expect(
          tool.getByLabel("Wire length", { exact: true }),
        ).toHaveValue("1");
        await page.reload();
        await root
          .getByRole("button", { name: "Open Wire resistance", exact: true })
          .click();
        await expect(tool.getByLabel("Material", { exact: true })).toHaveValue(
          "custom",
        );
        await expect(tool.getByLabel("Wire size", { exact: true })).toHaveValue(
          "awg",
        );
      },
    );
