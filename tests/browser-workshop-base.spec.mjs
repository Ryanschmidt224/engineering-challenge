import {test, expect} from "@playwright/test";

test.beforeEach(async ({page}) => {
  await page.goto("/workshop-preview.html");
  await expect(page.getByRole("heading", {level: 1})).toHaveText("¼ W resistor");
});
const example = (page, caption) => page.getByRole("navigation", {name: "Review examples"}).getByRole("button", {name: new RegExp(caption)});
const openSection = async (page, title) => {await page.locator("details.section > summary").filter({hasText: new RegExp("^" + title + "$")}).click();};

test("name-only creation inherits category and read view hides empty optional sections", async ({page}) => {
  const requests = []; page.on("request", request => {if (request.url().includes("/api/")) requests.push(request.url());});
  await page.getByRole("button", {name: "New item", exact: true}).click();
  await expect(page.getByLabel("Category", {exact: true})).toHaveValue("Basic Components");
  await expect(page.locator("#item-form [required]")).toHaveCount(1);
  await expect(page.getByLabel("Manufacturer part number", {exact: true})).toHaveCount(1);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByLabel("Item name", {exact: true}).fill("Name-only part");
  await page.getByRole("button", {name: "Keep draft in this tab", exact: true}).click();
  await expect(page.getByRole("status")).toContainText("Nothing was uploaded");
  await page.getByRole("button", {name: "Read view", exact: true}).click();
  await expect(page.getByRole("heading", {level: 1})).toHaveText("Name-only part");
  await expect(page.getByRole("heading", {name: /^(Ordering|Files & links|Notes|Stock|Specifications)$/})).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("all five examples use the same base form without browser errors", async ({page}) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  for (const caption of ["Purchased component", "Power supply", "Generic component", "Custom part", "Reusable tool"]) {
    await example(page, caption).click();
    await expect(page.getByRole("heading", {name: "Identity", exact: true})).toBeVisible();
    await expect(page.getByLabel("Item name", {exact: true})).not.toHaveValue("");
    await page.getByRole("button", {name: "Read view", exact: true}).click();
    await expect(page.getByRole("heading", {name: "Specifications", exact: true})).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("resistance entered for a project stays out of the reusable Workshop values", async ({page}) => {
  await expect(page.getByLabel("Power rating (W)", {exact: true})).toHaveValue("0.25");
  await page.getByRole("button", {name: "Try project use", exact: true}).click();
  await page.getByLabel("Resistance (Ω)", {exact: true}).fill("10000");
  await page.getByLabel("Reference designator", {exact: true}).fill("R1");
  await page.getByRole("button", {name: "Check project values", exact: true}).click();
  await expect(page.getByRole("status")).toContainText("Workshop item is unchanged");
  await page.getByRole("button", {name: "Edit item", exact: true}).click();
  await expect(page.getByLabel("Power rating (W)", {exact: true})).toHaveValue("0.25");
  await page.getByRole("button", {name: "Read view", exact: true}).click();
  await expect(page.locator("#item-form")).not.toContainText("10000");
  await page.getByRole("button", {name: "Try project use", exact: true}).click();
  await expect(page.getByLabel("Resistance (Ω)", {exact: true})).toHaveValue("10000");
});

test("template rename, reorder and removal preserve stored values with an explicit preview", async ({page}) => {
  await page.getByRole("button", {name: "Template builder", exact: true}).click();
  await page.getByLabel("Template name", {exact: true}).fill("Resistor layout");
  const power = page.locator('.definition[data-field-id="power"]');
  await power.getByLabel("Field name", {exact: true}).fill("Maximum power");
  await power.getByRole("button", {name: "Move down", exact: true}).click();
  await expect(page.locator(".definition").nth(1).getByLabel("Field name", {exact: true})).toHaveValue("Maximum power");
  await page.getByRole("button", {name: "Preview changes to item", exact: true}).click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toContainText("Updated or reordered");
  await dialog.getByRole("button", {name: "Apply layout", exact: true}).click();
  await expect(page.getByLabel("Maximum power (W)", {exact: true})).toHaveValue("0.25");
  await page.getByRole("button", {name: "Template builder", exact: true}).click();
  await page.locator('.definition[data-field-id="power"]').getByRole("button", {name: "Remove field", exact: true}).click();
  await page.getByRole("button", {name: "Preview changes to item", exact: true}).click();
  await expect(dialog).toContainText("Move to Additional saved details: Maximum power");
  await dialog.getByRole("button", {name: "Apply layout", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Additional saved details", exact: true})).toBeVisible();
  await expect(page.getByLabel("Maximum power (W)", {exact: true})).toHaveValue("0.25");
  await page.getByRole("button", {name: "Restore Maximum power", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Additional saved details", exact: true})).toHaveCount(0);
  await page.getByLabel("Category", {exact: true}).fill("Different category");
  await expect(page.getByLabel("Maximum power (W)", {exact: true})).toHaveValue("0.25");
});

test("incompatible template changes keep the draft and show the error inside the dialog", async ({page}) => {
  await page.getByRole("button", {name: "Template builder", exact: true}).click();
  const power = page.locator('.definition[data-field-id="power"]');
  await power.getByLabel("Unit", {exact: true}).fill("mW");
  await page.getByRole("button", {name: "Preview changes to item", exact: true}).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", {name: "Apply layout", exact: true}).click();
  await expect(dialog.getByRole("alert")).toContainText("No value was converted");
  await dialog.getByRole("button", {name: "Cancel", exact: true}).click();
  await expect(power.getByLabel("Unit", {exact: true})).toHaveValue("mW");
  await page.getByRole("button", {name: "Edit item", exact: true}).click();
  await expect(page.getByLabel("Power rating (W)", {exact: true})).toHaveValue("0.25");
});

test("ordering derives unit price and several documents share one collection", async ({page}) => {
  await openSection(page, "Ordering");
  await page.getByRole("button", {name: "Add supplier reference", exact: true}).click();
  await page.getByLabel("Supplier", {exact: true}).fill("Example vendor");
  await page.getByLabel("Quantity per package", {exact: true}).fill("5");
  await page.getByLabel("Package price", {exact: true}).fill("12");
  await expect(page.locator(".calculated")).toHaveText("Unit price: USD 2.4 per item");
  await openSection(page, "Files & links");
  for (const [index, label] of ["Datasheet", "Drawing"].entries()) {
    await page.getByRole("button", {name: "Add link", exact: true}).click();
    const reference = page.getByRole("group", {name: "Reference " + (index + 1), exact: true});
    await reference.getByLabel("Label", {exact: true}).fill(label);
    await reference.getByLabel("Link", {exact: true}).fill("https://example.test/" + label + ".pdf");
  }
  await page.getByRole("button", {name: "Read view", exact: true}).click();
  await expect(page.getByRole("link", {name: "Datasheet", exact: true})).toHaveAttribute("href", "https://example.test/Datasheet.pdf");
  await expect(page.getByRole("link", {name: "Drawing", exact: true})).toHaveAttribute("rel", "noopener noreferrer");
});

test("mobile form preserves zero and No, stays within the viewport and supports keyboard controls", async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await example(page, "Reusable tool").click();
  await page.getByLabel("Adjustable temperature", {exact: true}).selectOption("false");
  await openSection(page, "Stock");
  await page.getByRole("button", {name: "Track stock", exact: true}).click();
  await page.getByLabel("Stock quantity", {exact: true}).fill("0");
  await page.getByRole("button", {name: "Read view", exact: true}).click();
  await expect(page.locator('.specification[data-field-id="adjustable"] dd').first()).toHaveText("No");
  await expect(page.locator(".read-row").filter({has: page.getByText("Quantity", {exact: true})}).locator("dd")).toHaveText("0");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", {name: "Edit item", exact: true}).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Adjustable temperature", {exact: true})).toHaveValue("false");
});
