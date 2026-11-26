import { contextMenu } from "./context-menu.js";
// One header structure for Projects, Workshop and Knowledge.
export function initSiteHeader() {
  const header = document.querySelector("[data-site-header]");
  if (!header || header.dataset.headerReady) return;
  header.dataset.headerReady = "1";
  const projectPage = header.dataset.siteHeader === "projects";
  const projectHref =
    header.dataset.siteHeader === "home" ? "project.html" : "/";
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  const inner = make("div", "ui-site-header__inner ui-page");
  const brand = make("a", "ui-site-brand", "BUILDING ");
  brand.href = projectPage ? "#home" : projectHref;
  if (projectPage) brand.dataset.nav = "home";
  brand.append(make("span", "", "SCHMIDT"));
  const nav = make("nav", "ui-site-nav");
  nav.setAttribute("aria-label", "Main navigation");
  for (const [id, label, href] of [
    ["home", "Projects", projectHref],
    ["knowledge", "Info Bits", "knowledge.html"],
    ["commonparts", "The Workshop", "workshop.html"],
  ]) {
    const item = make(projectPage ? "button" : "a", "ui-site-nav__item", label);
    item.dataset.page = id;
    if (projectPage) {
      item.type = "button";
      item.dataset.nav = id;
    } else item.href = href;
    nav.append(item);
  }
  const account =
    header.querySelector(".ui-site-account") ||
    make(projectPage ? "button" : "a", "ui-button ui-site-account", "Account");
  if (projectPage) {
    account.type = "button";
    account.id = "accountMenuButton";
  } else account.href = "index.html?account=1#home";
  account.classList.remove("ui-site-account");
  account.classList.add("ui-site-account-action");
  account.hidden = true;
  const menuButton = make("button", "ui-button ui-site-account", "Account");
  menuButton.type = "button";
  menuButton.setAttribute("aria-haspopup", "menu");
  menuButton.setAttribute("aria-expanded", "false");
  let closeMenu = null;
  menuButton.onclick = () => {
    if (closeMenu) {
      closeMenu();
      return;
    }
    menuButton.setAttribute("aria-expanded", "true");
    closeMenu = contextMenu(
      menuButton,
      null,
      [
        { label: account.textContent || "Account", run: () => account.click() },
        { label: "Website settings", href: "website-settings.html" },
      ],
      {
        label: "Account menu",
        onClose: () => {
          closeMenu = null;
          menuButton.setAttribute("aria-expanded", "false");
        },
      },
    );
  };
  menuButton.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && !closeMenu) {
      event.preventDefault();
      menuButton.click();
    }
  });
  const accountActions = make("div", "ui-site-account-actions");
  accountActions.append(menuButton, account);
  inner.append(brand, nav, accountActions);
  header.append(inner);
  const update = () => {
    const route = location.hash.slice(1);
    const current = projectPage
      ? route === "calculators"
        ? "knowledge"
        : "home"
      : header.dataset.siteHeader === "calculators"
        ? "knowledge"
        : header.dataset.siteHeader;
    for (const item of nav.children)
      item.dataset.page === current
        ? item.setAttribute("aria-current", "page")
        : item.removeAttribute("aria-current");
  };
  update();
  window.addEventListener("hashchange", update);
  // Shared pages must follow the active engine, including an engine rollback.
  if (header.dataset.siteHeader !== "home") {
    fetch("/api/projects", { credentials: "same-origin", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.readOnly !== true) return;
        brand.href = "/project.html";
        delete brand.dataset.nav;
        const old = nav.querySelector('[data-page="home"]');
        const link = make("a", "ui-site-nav__item", "Projects");
        link.dataset.page = "home";
        link.href = "/project.html";
        if (old.hasAttribute("aria-current"))
          link.setAttribute("aria-current", "page");
        old.replaceWith(link);
      })
      .catch(() => {});
  }
}
