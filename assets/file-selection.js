export function fileDropTarget(
  onFiles,
  {
    multiple = true,
    label = "Drop files or paste an image",
    text = "Drop files or paste an image",
    onEmpty = () => {},
  } = {},
) {
  const deliver = (files, event) => {
    event?.preventDefault();
    event?.stopPropagation();
    const chosen = Array.from(files).slice(0, multiple ? undefined : 1);
    if (chosen.length) void onFiles(chosen, event);
    else onEmpty();
  };
  const target = window.BSPhotoMarkup.pasteTarget(
    (files, event) => deliver(files, event),
    { onEmpty },
  );
  target.textContent = text;
  target.setAttribute("aria-label", label);
  target.title = "Right-click and choose Paste, or press Ctrl+V.";
  // Capture actual files before the image-only paste target handles them. Keep
  // its editable surface for native context-menu image paste and HTML fallback.
  for (const type of ["drop", "paste"])
    target.addEventListener(
      type,
      (event) => {
        const files = event.dataTransfer?.files || event.clipboardData?.files;
        if (!files?.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        target.classList.remove("is-dragover");
        deliver(files, event);
      },
      { capture: true },
    );
  return target;
}
