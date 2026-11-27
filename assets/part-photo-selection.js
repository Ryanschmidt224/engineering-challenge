// A main-photo drop is a selection of an existing, scoped library member.
// File uploads belong exclusively to the library's shared picker/drop target.
export function wireMainPhotoSlot(slot, ctx, itemId, select) {
  slot.classList.add("project-main-photo-slot");
  slot.setAttribute("role", "region");
  slot.setAttribute("aria-label", "Main photo slot");
  slot.tabIndex = 0;
  const supported = (event) =>
    [...event.dataTransfer.types].includes("application/x-bs-part-photo");
  slot.addEventListener("dragover", (event) => {
    if (supported(event) || [...event.dataTransfer.types].includes("Files")) {
      event.preventDefault();
      event.stopPropagation();
      slot.classList.add("is-dragover");
    }
  });
  slot.addEventListener("dragleave", () =>
    slot.classList.remove("is-dragover"),
  );
  slot.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    slot.classList.remove("is-dragover");
    let selected;
    try {
      selected = JSON.parse(
        event.dataTransfer.getData("application/x-bs-part-photo"),
      );
    } catch {
      ctx.notify(
        "Add files in the photo library, then drag a library photo here.",
      );
      return;
    }
    if (selected.projectId !== ctx.projectId || selected.itemId !== itemId) {
      ctx.notify("Choose a photo from this part’s library.");
      return;
    }
    const row = ctx.client.state.media.find(
      (row) =>
        row.id === selected.mediaId && row.active && row.item_id === itemId,
    );
    if (!row) {
      ctx.notify("This photo is no longer available. Refresh the library.");
      return;
    }
    void select(row);
  });
}
