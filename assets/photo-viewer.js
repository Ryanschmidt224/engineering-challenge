/* Shared full-screen photo viewer for Workshop, project and instruction photos.
 * Double-click opens the image; single-click actions are left untouched.
 */
(() => {
  "use strict";
  if (window.BSPhotoViewer) return;
  let dialog = null;
  const photoFrom = (target) => {
    if (!(target instanceof Element)) return null;
    const img = target.closest("img");
    if (!img || !img.isConnected || img.closest(".bs-photo-fullscreen"))
      return null;
    if (img.closest("nav, .top, .bs-markup-toolbar, .bs-photo-actions"))
      return null;
    const src = img.currentSrc || img.src;
    if (!src || (/^(?:data:|blob:)/i.test(src) && !img.complete)) return null;
    // Ignore icons and decorative logos, but include local Workshop API photos.
    if (/\.svg(?:[?#]|$)/i.test(src)) return null;
    if (img.naturalWidth < 48 && img.naturalHeight < 48) return null;
    return img;
  };
  const close = () => {
    if (!dialog) return;
    const active = dialog;
    dialog = null;
    if (active.open) active.close();
    active.remove();
  };
  const show = (img) => {
    if (dialog) close();
    const modal = document.createElement("dialog");
    modal.className = "bs-photo-fullscreen";
    modal.setAttribute("aria-label", "Full-screen photo");
    const header = document.createElement("div");
    header.className = "bs-photo-fullscreen-header";
    const title = document.createElement("span");
    title.textContent = img.alt || "Photo";
    title.className = "bs-photo-fullscreen-title";
    const exit = document.createElement("button");
    exit.type = "button";
    exit.className = "bs-photo-fullscreen-close";
    exit.textContent = "Close ✕";
    exit.setAttribute("aria-label", "Close full-screen photo");
    exit.addEventListener("click", close);
    const gallery = img.closest(".project-photo-gallery");
    const scope =
      img.closest(".ib-photos, .project-media-grid, .photo-grid") ||
      img.parentElement;
    const entries =
      gallery?.bsPhotoGallery?.() ||
      [...scope.querySelectorAll("img")].map((el) => ({
        src: el.currentSrc || el.src,
        alt: el.alt,
      }));
    for (const entry of entries)
      entry.src = new URL(entry.src, document.baseURI).href;
    let index = Math.max(
      0,
      entries.findIndex((entry) => entry.src === (img.currentSrc || img.src)),
    );
    const previous = document.createElement("button"),
      next = document.createElement("button");
    for (const [control, label, text, delta] of [
      [previous, "Previous photo", "‹", -1],
      [next, "Next photo", "›", 1],
    ]) {
      control.type = "button";
      control.className = "bs-photo-fullscreen-close";
      control.textContent = text;
      control.setAttribute("aria-label", label);
      control.hidden = entries.length < 2;
      control.onclick = () => cycle(delta);
    }
    header.append(title, previous, next, exit);
    const view = document.createElement("img");
    view.src = img.currentSrc || img.src;
    view.alt = img.alt || "Enlarged photo";
    view.decoding = "async";
    const stage = document.createElement("div");
    stage.className = "bs-photo-fullscreen-stage";
    stage.append(view);
    function cycle(delta) {
      if (entries.length < 2) return;
      index = (index + delta + entries.length) % entries.length;
      view.src = entries[index].src;
      view.alt = entries[index].alt || "Photo";
      title.textContent =
        (entries[index].alt || "Photo") +
        " · " +
        (index + 1) +
        " / " +
        entries.length;
    }
    modal.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        cycle(event.key === "ArrowLeft" ? -1 : 1);
      }
    });
    modal.append(header, stage);
    document.body.append(modal);
    dialog = modal;
    modal.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    modal.addEventListener("close", () => {
      if (dialog === modal) dialog = null;
      modal.remove();
    });
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    modal.showModal();
    exit.focus();
  };
  document.addEventListener(
    "dblclick",
    (event) => {
      const img = photoFrom(event.target);
      if (!img) return;
      event.preventDefault();
      event.stopPropagation();
      show(img);
    },
    true,
  );
  window.BSPhotoViewer = Object.freeze({ open: show, close });
})();
