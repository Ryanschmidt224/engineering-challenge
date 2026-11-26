// One transient menu surface, with the same shared controls as the page.
let active = null;
export function contextMenu(
  trigger,
  event,
  items,
  { onClose = () => {}, label = null } = {},
) {
  active?.();
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.setAttribute("role", "menu");
  if (label) menu.setAttribute("aria-label", label);
  const box = trigger.getBoundingClientRect(),
    x = event?.clientX ?? box.left,
    y = event?.clientY ?? box.bottom;
  const scrolled = () => {
    const current = trigger.getBoundingClientRect();
    if (current.top !== box.top || current.left !== box.left) close();
  };
  const close = () => {
    menu.remove();
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", keys, true);
    window.removeEventListener("scroll", scrolled, true);
    if (active === close) active = null;
    onClose();
  };
  const outside = (e) => {
    if (!menu.contains(e.target) && !trigger.contains(e.target)) close();
  };
  const keys = (e) => {
    const buttons = [...menu.querySelectorAll("button,a[href]")],
      index = buttons.indexOf(document.activeElement);
    if (e.key === "Escape" || e.key === "Tab") {
      close();
      trigger.focus();
      if (e.key === "Escape") e.preventDefault();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      buttons[
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? buttons.length - 1
            : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
              buttons.length
      ]?.focus();
    }
  };
  for (const item of items) {
    const control = document.createElement(item.href ? "a" : "button");
    control.className = "ui-button ui-button--quiet";
    control.textContent = item.label;
    control.setAttribute("role", "menuitem");
    if (item.href) {
      control.href = item.href;
      control.addEventListener("click", close);
    } else {
      control.type = "button";
      control.onclick = () => {
        close();
        void item.run();
      };
    }
    menu.append(control);
  }
  document.body.append(menu);
  menu.style.left =
    Math.max(0, Math.min(x, innerWidth - menu.offsetWidth)) + "px";
  menu.style.top =
    Math.max(0, Math.min(y, innerHeight - menu.offsetHeight)) + "px";
  active = close;
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", keys, true);
  window.addEventListener("scroll", scrolled, true);
  menu.querySelector("button,a[href]")?.focus({ preventScroll: true });
  return close;
}
