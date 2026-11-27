import { mediaUploadFeedback } from "./media-upload-feedback.js";
import { fileDropTarget } from "./file-selection.js";
import { node, field, actions } from "./workshop-ui.js";
import { confirmAction } from "./project-editors.js";

// Project/part photo galleries and the part picture. Removing a photo hides it;
// the stored file and its row are kept. Double-click a photo for full size.
const button = (...args) => window.BSUI.button(...args);
const SHOWN = /^image\/(jpeg|png|webp|gif|avif)$/;
const src = (ctx, file) =>
  "/api/project-engine/projects/" +
  ctx.projectId +
  "/files/" +
  file.id +
  "?inline=1";
const fileOf = (ctx, row) =>
  ctx.client.state.files.find((file) => file.id === row.file_id);
// Keep a gallery open across the page refresh that follows each save.
const opened = new Set();
// Ordered photo rows are authoritative. Old standalone pictures remain visible
// until their next reorder converts that same row into a gallery member.
export function photosFor(state, itemId = null) {
  const photos = (state.media || [])
    .filter(
      (row) =>
        row.active && row.role === "photo" && (row.item_id || null) === itemId,
    )
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const legacy = (state.media || []).find(
    (row) => row.active && row.role === "picture" && row.item_id === itemId,
  );
  if (legacy && !photos.some((row) => row.file_id === legacy.file_id))
    photos.push(legacy);
  return photos;
}

function thumbnail(ctx, file, alt) {
  if (!file) return node("p", "Unavailable photo", "muted");
  if (!SHOWN.test(file.content_type)) {
    const note = node("p", "", "muted");
    note.append(
      document.createTextNode(
        file.name +
          " can't be shown here (HEIC photos need converting to JPG). ",
      ),
    );
    const link = node("a", "Download");
    link.href = src(ctx, file).replace("?inline=1", "");
    note.append(link);
    return note;
  }
  const img = node("img", "", "project-media-image");
  img.src = src(ctx, file);
  img.alt = alt || file.name;
  img.loading = "lazy";
  img.title = "Double-click for full size";
  return img;
}
// Upload images as supporting files, then attach them in one guarded save.
async function addFiles(
  ctx,
  files,
  { itemId = null, onProgress = () => {} } = {},
) {
  const images = files.filter(
    (file) => file.type.startsWith("image/") || /\.hei[cf]$/i.test(file.name),
  );
  if (!images.length) {
    ctx.notify("Choose image files.");
    return;
  }
  if (images.some((file) => file.size > 20 * 1024 * 1024)) {
    ctx.notify("Choose images of at most 20 MB each.");
    return;
  }
  onProgress({ phase: "uploading", images });
  ctx.notify(
    "Uploading " +
      images.length +
      " photo" +
      (images.length === 1 ? "" : "s") +
      "…",
  );
  try {
    const fileIds = [];
    for (const file of images.slice(0, 20))
      fileIds.push((await ctx.client.upload(ctx.projectId, file)).fileId);
    onProgress({ phase: "saving" });
    await ctx.client.write(ctx.projectId, "/media", "POST", {
      fileIds,
      role: "photo",
      ...(itemId ? { itemId } : {}),
    });
    onProgress({ phase: "refreshing" });
    if ((await ctx.refresh()) === false)
      throw Error(
        "Photo saved, but the page could not refresh. Reload to see it.",
      );
    onProgress({ phase: "complete" });
    ctx.notify(
      fileIds.length +
        " photo" +
        (fileIds.length === 1 ? "" : "s") +
        " added." +
        (images.length > 20
          ? " Add the rest in another batch of up to 20."
          : ""),
    );
  } catch (error) {
    onProgress({ phase: "error", message: error.message });
    ctx.notify(error.message);
  }
}
function picker(onFiles, { multiple = true, label }) {
  const input = node("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = multiple;
  input.hidden = true;
  input.setAttribute("aria-label", label);
  input.onchange = () => {
    const files = [...input.files];
    input.value = "";
    if (files.length) onFiles(files);
  };
  return { input, open: () => input.click() };
}
function acceptDrops(area, onFiles) {
  area.addEventListener("paste", (event) => {
    const files = [...(event.clipboardData?.files || [])];
    if (files.length) {
      event.preventDefault();
      onFiles(files);
    }
  });
  area.addEventListener("dragover", (event) => {
    if ([...event.dataTransfer.types].includes("Files")) event.preventDefault();
  });
  area.addEventListener("drop", (event) => {
    const files = [...event.dataTransfer.files];
    if (files.length) {
      event.preventDefault();
      event.stopPropagation();
      onFiles(files);
    }
  });
}
function editCaption(ctx, row) {
  let caption = row.caption;
  const dialog = ctx.dialog,
    form = node("form"),
    error = node("p", "", "error");
  form.append(
    field("Caption", caption, (value) => (caption = value)),
    error,
    actions(
      button("Save caption", () => form.requestSubmit(), {
        variant: "primary",
      }),
      button("Cancel", () => dialog.close()),
    ),
  );
  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      await ctx.client.write(ctx.projectId, "/media/" + row.id, "PATCH", {
        caption,
      });
      await ctx.refresh();
      dialog.close();
      ctx.notify("Caption saved.");
    } catch (problem) {
      error.textContent = problem.message;
    }
  };
  dialog.replaceChildren(node("h2", "Photo caption"), form);
  dialog.setAttribute("aria-label", "Photo caption");
  dialog.showModal();
  form.querySelector("input")?.focus();
}

// Shared ordered gallery for project summaries, parts and subassemblies.
// Viewer position belongs to this mounted component, never a cross-page cache.
export function orderedPhotoGallery(
  ctx,
  { itemId = null, title = "Photos" } = {},
) {
  const key = ctx.projectId + ":" + (itemId || "project"),
    photos = photosFor(ctx.client.state, itemId);
  const root = node("section", "", "project-photo-gallery"),
    header = node("div", "", "part-photo-heading"),
    layout = node("div", "", "part-photo-layout"),
    main = node("section", "", "part-photo-main"),
    slot = node("div", "", "part-photo-slot"),
    library = node("section", "", "part-photo-library"),
    navigation = node("div", "", "part-photo-navigation"),
    position = node("span"),
    grid = node("div", "", "project-media-grid"),
    orderStatus = node("div", "", "project-upload-feedback"),
    orderProgress = node("progress"),
    orderMessage = node("span");
  const tiles = new Map();
  orderStatus.hidden = true;
  orderStatus.setAttribute("role", "status");
  orderStatus.setAttribute("aria-live", "polite");
  orderProgress.setAttribute("aria-label", "Saving photo order");
  orderStatus.append(orderProgress, orderMessage);
  root.dataset.photoOwner = itemId || "project";
  library.dataset.section = itemId ? "part-photos" : "project-photos";
  slot.setAttribute("role", "region");
  slot.setAttribute("aria-label", "Photo viewer");
  slot.tabIndex = 0;
  let open = opened.has(key),
    index = 0,
    busy = false;
  const toggle = button(
    open ? "Done" : "Edit photos",
    () => {
      open = !open;
      open ? opened.add(key) : opened.delete(key);
      setExpanded();
    },
    { variant: open ? "primary" : "", small: true },
  );
  toggle.classList.add("part-photo-toggle");
  function setExpanded() {
    toggle.textContent = open ? "Done" : "Edit photos";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("ui-button--primary", open);
    library.hidden = !open;
    layout.classList.toggle("part-photo-layout--collapsed", !open);
  }
  root.bsPhotoGallery = () =>
    photos
      .map((photo) => {
        const file = fileOf(ctx, photo);
        return file && SHOWN.test(file.content_type)
          ? { src: src(ctx, file), alt: photo.caption || file.name }
          : null;
      })
      .filter(Boolean);
  function renderView() {
    const photo = photos[index],
      file = photo && fileOf(ctx, photo);
    slot.replaceChildren(
      file
        ? thumbnail(ctx, file, photo.caption || file.name)
        : node("span", "No photos yet", "muted"),
    );
    const image = slot.querySelector("img");
    if (image) {
      image.className = "project-picture";
      image.loading = "eager";
    }
    position.textContent =
      (photos.length ? index + 1 : 0) + " / " + photos.length;
    navigation.hidden = photos.length < 2;
  }
  function cycle(delta) {
    if (!photos.length) return;
    index = (index + delta + photos.length) % photos.length;
    renderView();
  }
  const previous = button("‹", () => cycle(-1), { small: true }),
    next = button("›", () => cycle(1), { small: true });
  previous.setAttribute("aria-label", "Previous photo");
  next.setAttribute("aria-label", "Next photo");
  position.setAttribute("aria-live", "polite");
  navigation.append(previous, position, next);
  slot.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      cycle(event.key === "ArrowLeft" ? -1 : 1);
    }
  });
  async function reorder(ids) {
    if (busy || ids.every((id, i) => id === photos[i].id)) return;
    const before = ctx.client.state;
    busy = true;
    layout.inert = true;
    layout.setAttribute("aria-busy", "true");
    toggle.disabled = true;
    orderStatus.hidden = false;
    orderProgress.hidden = false;
    orderMessage.textContent = "Saving photo order…";
    try {
      const result = await ctx.client.write(
        ctx.projectId,
        "/media/reorder",
        "POST",
        {
          ids,
          ...(itemId ? { itemId } : {}),
        },
      );
      if (
        root.isConnected &&
        ctx.client.state === before &&
        before.project.revision === result.revision
      ) {
        // The command confirms only order/role changes. Reuse the loaded rows and
        // thumbnail nodes instead of fetching/rebuilding the entire workspace.
        const byId = new Map(photos.map((photo) => [photo.id, photo]));
        photos.splice(0, photos.length, ...ids.map((id) => byId.get(id)));
        for (const [i, photo] of photos.entries()) {
          photo.sort_order = i;
          photo.role = "photo";
          const { tile, earlier, later, label } = tiles.get(photo.id);
          tile.classList.toggle("project-library-main", i === 0);
          label.textContent = i === 0 ? "1 · Main" : String(i + 1);
          earlier.disabled = i === 0;
          later.disabled = i === photos.length - 1;
          earlier.setAttribute(
            "aria-label",
            "Move photo " + (i + 1) + " earlier",
          );
          later.setAttribute("aria-label", "Move photo " + (i + 1) + " later");
          grid.append(tile);
        }
        index = 0;
        renderView();
      } else {
        orderMessage.textContent = "Order saved. Loading updated photos…";
        if ((await ctx.refresh()) === false)
          throw Error("Order saved. Reload to see the new order.");
      }
      orderStatus.hidden = true;
      ctx.notify("Photo order saved.");
    } catch (error) {
      orderMessage.textContent = error.message;
      ctx.notify(error.message);
    } finally {
      busy = false;
      layout.inert = false;
      layout.setAttribute("aria-busy", "false");
      toggle.disabled = false;
      orderProgress.hidden = true;
    }
  }
  const move = (from, to) => {
    const ids = photos.map((photo) => photo.id);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    return reorder(ids);
  };
  grid.dataset.view = "tiles";
  photos.forEach((photo, i) => {
    const file = fileOf(ctx, photo),
      tile = node("figure", "", "project-media-tile"),
      image = thumbnail(ctx, file, photo.caption || file?.name),
      name = button(
        photo.caption || file?.name || "Photo",
        () => editCaption(ctx, photo),
        { variant: "quiet", small: true },
      );
    name.classList.add("part-library-name");
    name.setAttribute(
      "aria-label",
      "Edit caption for " + (photo.caption || file?.name || "photo"),
    );
    tile.classList.toggle("project-library-main", i === 0);
    tile.dataset.mediaId = photo.id;
    tile.draggable = true;
    tile.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData(
        "application/x-bs-photo-order",
        JSON.stringify({ projectId: ctx.projectId, itemId, mediaId: photo.id }),
      );
      event.dataTransfer.effectAllowed = "move";
    });
    tile.addEventListener("dragover", (event) => {
      if (
        [...event.dataTransfer.types].includes("application/x-bs-photo-order")
      ) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }
    });
    tile.addEventListener("drop", (event) => {
      if (
        ![...event.dataTransfer.types].includes("application/x-bs-photo-order")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      let data;
      try {
        data = JSON.parse(
          event.dataTransfer.getData("application/x-bs-photo-order"),
        );
      } catch {
        return;
      }
      if (data.projectId !== ctx.projectId || data.itemId !== itemId) return;
      const from = photos.findIndex((row) => row.id === data.mediaId);
      if (from >= 0)
        void move(
          from,
          photos.findIndex((row) => row.id === photo.id),
        );
    });
    const earlier = button(
        "←",
        () => {
          const at = photos.indexOf(photo);
          return move(at, at - 1);
        },
        {
          variant: "quiet",
          small: true,
        },
      ),
      later = button(
        "→",
        () => {
          const at = photos.indexOf(photo);
          return move(at, at + 1);
        },
        {
          variant: "quiet",
          small: true,
        },
      ),
      remove = button(
        "×",
        () =>
          confirmAction(
            ctx,
            "Remove photo",
            "Remove this photo? Its stored file is kept.",
            "Remove photo",
            (token) =>
              ctx.client.write(
                ctx.projectId,
                "/media/" + photo.id + "/remove",
                "POST",
                { fromLibrary: true },
                token,
              ),
          ),
        { variant: "quiet", small: true },
      );
    earlier.disabled = i === 0;
    later.disabled = i === photos.length - 1;
    earlier.setAttribute("aria-label", "Move photo " + (i + 1) + " earlier");
    later.setAttribute("aria-label", "Move photo " + (i + 1) + " later");
    remove.setAttribute(
      "aria-label",
      "Remove " + (photo.caption || file?.name || "photo"),
    );
    const label = node(
      "strong",
      i === 0 ? "1 · Main" : String(i + 1),
      "project-library-main-label",
    );
    tiles.set(photo.id, { tile, earlier, later, label });
    tile.append(image, name, label, actions(earlier, later, remove));
    grid.append(tile);
  });
  const feedback = mediaUploadFeedback(),
    add = (files) =>
      addFiles(ctx, files, { itemId, onProgress: feedback.update }),
    choose = picker(add, { label: "Photo library files" }),
    upload = node("div", "", "bs-photo-upload-row"),
    paste = fileDropTarget(add, {
      label: "Paste a copied photo",
      text: "Drop photos or paste an image",
    });
  upload.append(button("Add photos", choose.open), paste, choose.input);
  library.append(grid, upload, feedback.root);
  acceptDrops(library, add);
  header.append(node("strong", title), toggle);
  main.append(slot, navigation);
  layout.append(main, library);
  root.append(header, orderStatus, layout);
  setExpanded();
  renderView();
  return root;
}
export function partPicture(ctx, item) {
  return orderedPhotoGallery(ctx, {
    itemId: item.id,
    title: item.is_assembly ? "Subassembly photos" : "Part photos",
  });
}
export function projectPicture(ctx, { assembly = null } = {}) {
  const holder = node("div", "", "project-photos");
  holder.append(orderedPhotoGallery(ctx, { title: "Project photos" }));
  if (assembly)
    holder.append(
      orderedPhotoGallery(ctx, {
        itemId: assembly.id,
        title: "Top assembly · " + assembly.part_number,
      }),
    );
  return holder;
}
