import { pasteTarget } from "./clipboard-files.js";
// A shared image stage, quiet pencil and tool disclosure. Persistence belongs
// to the caller; this component performs no project or Workshop requests.
export function actionBar(cover, { content, expanded = false, onToggle } = {}) {
  if (!cover || !content)
    throw Error("Photo controls require an image stage and tools.");
  const make = (tag, className) => {
    const el = document.createElement(tag);
    el.className = className;
    return el;
  };
  const shell = make("div", "bs-photo-control bs-photo-custom-tools"),
    stage = make("div", "bs-photo-stage"),
    bar = make("div", "bs-photo-actions"),
    more = make("div", "bs-photo-more");
  cover.before(shell);
  shell.append(stage, bar);
  stage.append(cover);
  bar.append(more);
  more.append(content);
  more.style.flexBasis = "100%";
  const edit = window.BSUI.button(
    "",
    () => setExpanded(edit.getAttribute("aria-expanded") !== "true"),
    { className: "bs-photo-toggle" },
  );
  edit.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg>';
  edit.title = "Edit photo";
  edit.setAttribute("aria-label", "Edit photo");
  stage.append(edit);
  function setExpanded(next) {
    edit.setAttribute("aria-expanded", String(next));
    more.hidden = !next;
    onToggle?.(next);
  }
  const done = window.BSUI.button("Done", () => setExpanded(false), {
    small: true,
    variant: "primary",
    className: "bs-photo-save",
  });
  done.title = "Close photo tools";
  more.append(done);
  edit.setAttribute("aria-expanded", String(expanded));
  more.hidden = !expanded;
  return { shell, edit, panel: more };
}

export function uploadPanel({
  onFiles,
  accept = "image/*,.heic,.heif",
  multiple = true,
  title = "Add photos",
  hint = "",
} = {}) {
  if (typeof onFiles !== "function")
    throw Error("Photo upload requires an onFiles callback");
  const panel = document.createElement("section");
  panel.className = "bs-upload-panel";
  panel.hidden = true;
  const heading = document.createElement("div");
  heading.className = "bs-upload-heading";
  const name = document.createElement("strong");
  name.textContent = title;
  const close = window.BSUI.button("Done", () => {
    panel.hidden = true;
  });
  close.classList.add("bs-upload-close");
  heading.append(name, close);
  const text = document.createElement("p");
  text.className = "bs-upload-hint";
  text.textContent =
    "Drop files in the box, right-click and Paste an image, or choose files from your device.";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = accept;
  fileInput.multiple = multiple;
  fileInput.hidden = true;
  const choose = window.BSUI.button(
    multiple ? "Choose files" : "Choose file",
    () => fileInput.click(),
  );
  choose.classList.add("bs-upload-choose");
  const drop = pasteTarget((files) => onFiles(files));
  drop.classList.add("bs-upload-drop");
  drop.textContent = "Drop files or paste an image";
  drop.title = "Right-click and choose Paste, or press Ctrl+V.";
  drop.addEventListener(
    "drop",
    (event) => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      drop.classList.remove("is-dragover");
      void onFiles(
        [...event.dataTransfer.files].slice(0, multiple ? undefined : 1),
      );
    },
    true,
  );
  fileInput.onchange = () => {
    const files = [...(fileInput.files || [])];
    fileInput.value = "";
    if (files.length) void onFiles(files);
  };
  const row = document.createElement("div");
  row.className = "bs-photo-upload-row";
  row.append(choose, drop);
  panel.append(heading, text, row, fileInput);
  if (hint) {
    const note = document.createElement("p");
    note.className = "bs-upload-hint";
    note.textContent = hint;
    panel.append(note);
  }
  return {
    panel,
    open(nextTitle) {
      name.textContent = nextTitle || title;
      panel.hidden = false;
      drop.focus();
    },
    close() {
      panel.hidden = true;
    },
    choose,
    drop,
    fileInput,
  };
}
