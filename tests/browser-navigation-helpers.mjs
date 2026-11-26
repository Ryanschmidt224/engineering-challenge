export async function openWebsiteSettings(page) {
  await page.locator(".ui-site-account").click();
  await page
    .getByRole("menuitem", { name: "Website settings", exact: true })
    .click();
}
export async function openAccount(page) {
  await page.locator(".ui-site-account").click();
  await page
    .getByRole("menu", { name: "Account menu", exact: true })
    .getByRole("menuitem", { name: /^(Account|Sign in)$/ })
    .click();
}
export async function openProjectRestore(page) {
  await openWebsiteSettings(page);
  await page
    .locator('[data-section="website-project-restore"] > summary')
    .click();
}
