// Shared UI kit (window.BSUI): the one way to build sections and buttons on
// the project pages. Styling lives in assets/ui-kit.css; rules in
// docs/UI_STANDARDS.md. Text is always set with textContent.
(function () {
  "use strict";
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  // A collapsible section with the standard header: chevron, title,
  // "(N records)" count, and an optional area on the right for help or actions.
  //   role:    stable hook for code and tests (data-section="...")
  //   quiet:   frameless variant for utility sections (backups, recent changes)
  //   tooltip: short explanation shown on hover of the header
  function section({title, role = "", count = null, countLabel = ["record", "records"], open = false, quiet = false, tooltip = ""} = {}) {
    const root = make("details", "ui-section" + (quiet ? " ui-section--quiet" : ""));
    if (role) root.dataset.section = role;
    root.open = !!open;
    const header = make("summary", "ui-section__header");
    if (tooltip) {
      header.title = tooltip;
      header.setAttribute("aria-description", tooltip);
    }
    const titleElement = make("h2", "ui-section__title", title);
    const countElement = make("span", "ui-section__count");
    const aside = make("span", "ui-section__aside");
    header.append(titleElement, countElement, aside);
    const body = make("div", "ui-section__body");
    root.append(header, body);
    const api = {
      root,
      header,
      title: titleElement,
      count: countElement,
      aside,
      body,
      setCount(value) {
        countElement.textContent =
          value === null || value === undefined ? "" : "(" + value + " " + (value === 1 ? countLabel[0] : countLabel[1]) + ")";
      },
    };
    api.setCount(count);
    return api;
  }

  // Turn an existing header + body pair that is opened by a button (not a
  // <details>) into the standard section look, e.g. Work instructions.
  function sectionShell(container, toggle, body, role = "") {
    container.classList.add("ui-section");
    if (role) container.dataset.section = role;
    toggle.classList.add("ui-section__header");
    body.classList.add("ui-section__body");
    const sync = () => container.classList.toggle("is-open", toggle.getAttribute("aria-expanded") === "true");
    new MutationObserver(sync).observe(toggle, {attributes: true, attributeFilter: ["aria-expanded"]});
    sync();
  }

  // variant: "" | "primary" | "quiet" | "danger"; small: compact in-row action.
  function button(label, onClick, {variant = "", small = false, className = ""} = {}) {
    const element = make(
      "button",
      ["ui-button", variant && "ui-button--" + variant, small && "ui-button--small", className].filter(Boolean).join(" "),
      label,
    );
    element.type = "button";
    if (onClick) element.addEventListener("click", onClick);
    return element;
  }

  window.BSUI = Object.freeze({section, sectionShell, button});
})();
