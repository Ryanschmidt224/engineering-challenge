// Shared, browser-local presentation preferences. No API or project-data writes.
export function fitPaneWidths(desired, minimums, maximum, available) {
  const widths = desired.map((value, index) => Math.min(maximum, Math.max(minimums[index], value)));
  const extra = Math.max(0, widths.reduce((sum, value) => sum + value, 0) - available);
  const shrinkable = widths.reduce((sum, value, index) => sum + value - minimums[index], 0);
  if (extra && shrinkable) return widths.map((value, index) => value - Math.min(1, extra / shrinkable) * (value - minimums[index]));
  return widths;
}
export function initSplitPanes(root, {key, panes}) {
  if (!root || root.dataset.panesReady) return;
  root.dataset.panesReady = "true";
  const preferencesKey = "building-schmidt:panes:" + key;
  let preferences = {};
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey));
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      for (const pane of panes) if (typeof saved[pane.key] === "number" && Number.isFinite(saved[pane.key]) && saved[pane.key] > 0) preferences[pane.key] = saved[pane.key];
    }
  } catch { /* Disabled or invalid storage does not disable resizing. */ }
  const save = () => { try { localStorage.setItem(preferencesKey, JSON.stringify(preferences)); } catch {} };
  const tokenLength = name => {
    const value = getComputedStyle(root).getPropertyValue(name).trim();
    return parseFloat(value) * (value.endsWith("rem") ? parseFloat(getComputedStyle(document.documentElement).fontSize) : 1);
  };
  const narrow = matchMedia("(max-width: 640px)"), wide = matchMedia("(max-width: 1024px)");
  const records = panes.map(pane => {
    const element = root.querySelector(pane.selector);
    const handle = document.createElement("div");
    handle.className = "ui-pane-resizer";
    if (pane.wideOnly) handle.classList.add("ui-pane-resizer--wide");
    handle.tabIndex = 0;
    handle.setAttribute("role", "separator"); handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", "Resize " + pane.name + " column");
    handle.setAttribute("aria-description", "Drag or use Left and Right arrows to resize. Home sets the minimum, End the maximum. Double-click resets this column. Escape cancels a drag.");
    if (!element.id) element.id = key + "-pane-" + pane.key;
    handle.setAttribute("aria-controls", element.id);
    element.after(handle);
    return {...pane, element, handle, width: 0, maximum: 0};
  });
  let drag = null;
  const active = record => !narrow.matches && !(record.wideOnly && wide.matches);
  function apply() {
    const visible = records.filter(active), style = getComputedStyle(root);
    if (!visible.length) return;
    const minimum = tokenLength("--pane-list-min"), maximum = tokenLength("--pane-list-max");
    const budget = root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      - (parseFloat(style.columnGap) || 0) * visible.length * 2
      - tokenLength("--pane-handle-size") * visible.length - tokenLength("--pane-detail-min");
    const desired = visible.map(record => preferences[record.key] ?? tokenLength("--pane-default-" + record.key));
    const widths = fitPaneWidths(desired, visible.map(() => minimum), maximum, budget);
    for (let index = 0; index < visible.length; index++) {
      const record = visible[index]; record.width = widths[index];
      record.maximum = Math.max(minimum, Math.min(maximum, budget - widths.reduce((sum, value, other) => sum + (index === other ? 0 : value), 0)));
      root.style.setProperty("--pane-" + record.key, record.width + "px");
      record.handle.setAttribute("aria-valuemin", String(Math.round(minimum)));
      record.handle.setAttribute("aria-valuemax", String(Math.round(record.maximum)));
      record.handle.setAttribute("aria-valuenow", String(Math.round(record.width)));
      record.handle.setAttribute("aria-valuetext", Math.round(record.width) + " pixels");
    }
  }
  const setWidth = (record, width) => {
    for (const other of records.filter(active)) preferences[other.key] = other.width;
    preferences[record.key] = Math.max(tokenLength("--pane-list-min"), Math.min(record.maximum, width));
    apply();
  };
  function endDrag(cancel = false) {
    if (!drag) return;
    const previous = drag; drag = null;
    if (cancel) preferences = previous.preferences;
    else save();
    root.classList.remove("ui-pane-dragging");
    if (previous.record.handle.hasPointerCapture(previous.id)) previous.record.handle.releasePointerCapture(previous.id);
    apply();
  }
  for (const record of records) {
    record.handle.addEventListener("pointerdown", event => {
      if (event.button !== 0 || !active(record)) return;
      event.preventDefault();
      drag = {record, id: event.pointerId, x: event.clientX, width: record.width, preferences: {...preferences}};
      record.handle.setPointerCapture(event.pointerId); record.handle.focus(); root.classList.add("ui-pane-dragging");
    });
    record.handle.addEventListener("pointermove", event => {
      if (drag?.record === record && drag.id === event.pointerId) setWidth(record, drag.width + event.clientX - drag.x);
    });
    record.handle.addEventListener("pointerup", () => endDrag());
    record.handle.addEventListener("pointercancel", () => endDrag(true));
    record.handle.addEventListener("lostpointercapture", () => endDrag(true));
    record.handle.addEventListener("dblclick", () => { delete preferences[record.key]; apply(); save(); });
    record.handle.addEventListener("keydown", event => {
      if (event.key === "Escape") { if (drag) { event.preventDefault(); endDrag(true); } return; }
      if (!active(record) || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      setWidth(record, event.key === "Home" ? 0 : event.key === "End" ? record.maximum : record.width + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 40 : 16));
      save();
    });
  }
  const layoutChanged = () => { endDrag(true); apply(); };
  narrow.addEventListener("change", layoutChanged); wide.addEventListener("change", layoutChanged);
  let lastWidth = 0;
  new ResizeObserver(entries => { const width = entries[0].contentRect.width; if (width !== lastWidth) { lastWidth = width; layoutChanged(); } }).observe(root);
  apply();
}
