// One header structure for Projects, Workshop and Knowledge.
export function initSiteHeader() {
  const header = document.querySelector("[data-site-header]");
  if (!header) return;
  const projectPage = header.dataset.siteHeader === "projects";
  const make = (tag, className, text) => {
    const el = document.createElement(tag); el.className = className; if (text) el.textContent = text; return el;
  };
  const inner = make("div", "ui-site-header__inner");
  const brand = make("a", "ui-site-brand", "BUILDING "); brand.href = projectPage ? "#home" : "index.html#home";
  if (projectPage) brand.dataset.nav = "home";
  brand.append(make("span", "", "SCHMIDT"));
  const nav = make("nav", "ui-site-nav"); nav.setAttribute("aria-label", "Main navigation");
  for (const [id, label, href] of [["home", "Projects", "index.html#home"], ["knowledge", "Knowledge", "knowledge.html"], ["commonparts", "The Workshop", "workshop.html"], ["calculators", "Calculators", "index.html#calculators"]]) {
    const item = make(projectPage ? "button" : "a", "ui-site-nav__item", label);
    item.dataset.page = id;
    if (projectPage) { item.type = "button"; item.dataset.nav = id; } else item.href = href;
    nav.append(item);
  }
  const account = header.querySelector(".ui-site-account") || make(projectPage ? "button" : "a", "ui-button ui-site-account", "Account");
  if (projectPage) { account.type = "button"; account.id = "accountMenuButton"; }
  else account.href = "index.html?account=1#home";
  inner.append(brand, nav, account); header.append(inner);
  const update = () => {
    const route = location.hash.slice(1);
    const current = projectPage ? (route === "calculators" ? "calculators" : "home") : header.dataset.siteHeader;
    for (const item of nav.children) item.dataset.page === current ? item.setAttribute("aria-current", "page") : item.removeAttribute("aria-current");
  };
  update(); window.addEventListener("hashchange", update);
}
