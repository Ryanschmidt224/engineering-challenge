// Presentation preferences only; project content and backups are unaffected.
export function initSummaryState() {
  const bound = new WeakSet();
  const isOpen = section => section.tagName === "DETAILS" ? section.open : section.querySelector(".ui-section__header")?.getAttribute("aria-expanded") === "true";
  function bind() {
    for (const section of document.querySelectorAll(".project-summary-page [data-section]")) {
      if (bound.has(section)) continue;
      const project = section.closest(".view")?.id;
      const header = section.querySelector(".ui-section__header");
      if (!project || !header) continue;
      bound.add(section);
      const key = "building-schmidt:summary:" + project + ":" + section.dataset.section;
      try {
        const saved = localStorage.getItem(key);
        if (saved !== null && (saved === "open") !== isOpen(section)) {
          if (section.tagName === "DETAILS") section.open = saved === "open";
          else header.click();
        }
      } catch { /* Storage may be disabled; first visits remain collapsed. */ }
      const remember = () => {
        try { localStorage.setItem(key, isOpen(section) ? "open" : "closed"); } catch {}
      };
      if (section.tagName === "DETAILS") section.addEventListener("toggle", remember);
      else new MutationObserver(remember).observe(header, {attributes: true, attributeFilter: ["aria-expanded"]});
    }
  }
  bind();
  // Project workspaces are created asynchronously after owner sign-in.
  new MutationObserver(bind).observe(document.querySelector("main"), {childList: true, subtree: true});
}
