// Native image clipboard/drop selection, independent of storage APIs.
const imageFile = (file) =>
  file.type.startsWith("image/") ||
  /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
function pasteOn(root, handler, { multiple = false, onEmpty } = {}) {
  root.addEventListener("paste", (event) => {
    if (event.defaultPrevented) return;
    const clipboard = event.clipboardData;
    let files = [...(clipboard?.files || [])].filter(imageFile);
    if (!files.length)
      files = [...(clipboard?.items || [])]
        .filter(
          (item) => item.kind === "file" && item.type.startsWith("image/"),
        )
        .map((item) => item.getAsFile())
        .filter(Boolean);
    if (!files.length) {
      if (onEmpty) {
        event.preventDefault();
        onEmpty();
      }
      return;
    }
    event.preventDefault();
    files = files.map((file) => {
      if (/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) return file;
      const ext = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/heic": "heic",
        "image/heif": "heif",
      }[file.type];
      return ext
        ? new File([file], "pasted-photo." + ext, { type: file.type })
        : file;
    });
    void handler(multiple ? files : files[0], event);
  });
}
export function pasteTarget(onFiles, { onEmpty = () => {} } = {}) {
  const box = document.createElement("div");
  box.className = "bs-photo-paste";
  box.contentEditable = "true";
  box.setAttribute("role", "textbox");
  box.setAttribute("aria-label", "Paste a copied photo");
  box.spellcheck = false;
  box.tabIndex = 0;
  box.textContent = "Right-click here and choose Paste (or press Ctrl+V).";
  box.addEventListener("beforeinput", (event) => event.preventDefault());
  pasteOn(box, onFiles, { multiple: true, onEmpty });
  box.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
    box.classList.add("is-dragover");
  });
  box.addEventListener("dragleave", () => box.classList.remove("is-dragover"));
  box.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    box.classList.remove("is-dragover");
    const files = [...(event.dataTransfer?.files || [])].filter(imageFile);
    if (files.length) void onFiles(files, event);
    else onEmpty();
  });
  return box;
}
