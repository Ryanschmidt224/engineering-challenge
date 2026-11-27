import "./ui-kit.js";
import { initProjectSignin } from "./project-signin.js";
import { contextMenu } from "./context-menu.js";
// One header structure for Projects, Workshop and Knowledge.
export function initSiteHeader() {
  const header = document.querySelector("[data-site-header]");
  if (!header || header.dataset.headerReady) return;
  header.dataset.headerReady = "1";
  const projectHref = "/project.html";
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  const inner = make("div", "ui-site-header__inner ui-page");
  const brand = make("a", "ui-site-brand", "BUILDING ");
  brand.href = projectHref;
  brand.append(make("span", "", "SCHMIDT"));
  const nav = make("nav", "ui-site-nav");
  nav.setAttribute("aria-label", "Main navigation");
  for (const [id, label, href] of [
    ["home", "Projects", projectHref],
    ["knowledge", "Lessons Learned", "knowledge.html"],
    ["commonparts", "The Workshop", "workshop.html"],
  ]) {
    const item = make("a", "ui-site-nav__item", label);
    item.dataset.page = id;
    item.href = href;
    nav.append(item);
  }
  const account =
    header.querySelector(".ui-site-account") ||
    make("a", "ui-button ui-site-account", "Account");
  account.href = "/project.html";
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
        { label: "Website settings", href: "/website-settings.html" },
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
  // Sticky page controls follow the actual responsive header height.
  const sizeHeader = () =>
    document.documentElement.style.setProperty(
      "--site-header-height",
      Math.ceil(header.getBoundingClientRect().height) + "px",
    );
  sizeHeader();
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(sizeHeader).observe(header);
  const update = () => {
    const current = ["calculators", "knowledge"].includes(
      header.dataset.siteHeader,
    )
      ? "knowledge"
      : header.dataset.siteHeader;
    for (const item of nav.children)
      item.dataset.page === current
        ? item.setAttribute("aria-current", "page")
        : item.removeAttribute("aria-current");
  };
  update();
  window.addEventListener("hashchange", update);
  initProjectSignin();
}
