import { wireMainPhotoSlot } from "./part-photo-selection.js";
import { mediaUploadFeedback } from "./media-upload-feedback.js";
import { actionBar } from "./photo-editor.js";
import { fileDropTarget } from "./file-selection.js";
import { viewMode } from "./view-mode.js";
import { node, field, actions } from "./workshop-ui.js";
import { confirmAction } from "./project-editors.js";

// Project/part photo galleries and the part picture. Removing a photo hides it;
// the stored file and its row are kept. Double-click a photo for full size.
const button = (...args) => window.BSUI.button(...args);
const SHOWN = /^image\/(jpeg|png|webp|gif|avif)$/,
  PICTURE = /^image\/(jpeg|png|webp)$/;
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
export const photosFor = (state, itemId = null) =>
  (state.media || [])
    .filter(
      (row) =>
        row.active && row.role === "photo" && (row.item_id || null) === itemId,
    )
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
export const pictureFor = (state, itemId) =>
  (state.media || []).find(
    (row) => row.active && row.role === "picture" && row.item_id === itemId,
  ) || null;

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
async function send(ctx, path, method, data, message) {
  try {
    await ctx.client.write(ctx.projectId, path, method, data);
    if ((await ctx.refresh()) === false)
      throw Error(
        "Change saved, but the page could not refresh. Reload to see it.",
      );
    ctx.notify(message);
  } catch (error) {
    ctx.notify(error.message);
  }
}
// Upload images as supporting files, then attach them in one guarded save.
async function addFiles(
  ctx,
  files,
  { itemId = null, role = "photo", onProgress = () => {} } = {},
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
  if (
    role === "picture" &&
    (images.length !== 1 ||
      !PICTURE.test(images[0].type) ||
      images[0].size >= 3 * 1024 * 1024)
  ) {
    ctx.notify(
      "A part picture must be one JPG, PNG or WebP image smaller than 3 MB.",
    );
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
      role,
      ...(itemId ? { itemId } : {}),
    });
    onProgress({ phase: "refreshing" });
    if ((await ctx.refresh()) === false)
      throw Error(
        "Photo saved, but the page could not refresh. Reload to see it.",
      );
    onProgress({ phase: "complete" });
    ctx.notify(
      role === "picture"
        ? "Picture saved. The earlier picture is kept in storage."
        : fileIds.length +
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

export function mediaGallery(
  ctx,
  {
    itemId = null,
    title = "Photos",
    partLibrary = false,
    selectMain = null,
  } = {},
) {
  const current = partLibrary ? pictureFor(ctx.client.state, itemId) : null,
    photos = photosFor(ctx.client.state, itemId);
  if (current && !photos.some((row) => row.file_id === current.file_id))
    photos.push(current);
  const body = node("div", "", "project-photo-tools"),
    section = { body, root: body };
  body.dataset.section = itemId ? "part-photos" : "project-photos";
  const feedback = mediaUploadFeedback();
  const add = (files) =>
      addFiles(ctx, files, { itemId, onProgress: feedback.update }),
    choose = picker(add, { label: title + " files" });
  const uploadRow = node("div", "", "bs-photo-upload-row"),
    addButton = button("Add photos", choose.open);
  const grid = node("div", "", "project-media-grid"),
    mode = viewMode({
      label: "Photo view",
      storageKey: "bs-photo-view",
      initial: "tiles",
      onChange: (value) => (grid.dataset.view = value),
    });
  grid.dataset.view = mode.value;
  const move = async (index, delta) => {
    const ids = photos.map((row) => row.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    await send(
      ctx,
      "/media/reorder",
      "POST",
      { ids, ...(itemId ? { itemId } : {}) },
      "Photo order saved.",
    );
  };
  photos.forEach((row, index) => {
    const file = fileOf(ctx, row),
      tile = node("figure", "", "project-media-tile"),
      caption = node(
        "figcaption",
        row.caption || file?.name || "Unavailable photo",
      );
    const remove = button(
      "Remove",
      () =>
        confirmAction(
          ctx,
          "Remove photo",
          partLibrary && current?.file_id === row.file_id
            ? "Remove this photo from the library and clear the main photo? The stored file is kept."
            : "Remove this photo from the gallery? The stored file is kept.",
          "Remove photo",
          (token) =>
            ctx.client.write(
              ctx.projectId,
              "/media/" + row.id + "/remove",
              "POST",
              partLibrary ? { fromLibrary: true } : {},
              token,
            ),
        ),
      { variant: "quiet", small: true },
    );
    const tools = actions(
      button("Caption", () => editCaption(ctx, row), {
        variant: "quiet",
        small: true,
      }),
      ...(!partLibrary && index > 0
        ? [
            button("←", () => move(index, -1), {
              variant: "quiet",
              small: true,
            }),
          ]
        : []),
      ...(!partLibrary && index < photos.length - 1
        ? [button("→", () => move(index, 1), { variant: "quiet", small: true })]
        : []),
      remove,
    );
    for (const control of tools.querySelectorAll("button"))
      if (["←", "→"].includes(control.textContent))
        control.setAttribute(
          "aria-label",
          control.textContent === "←"
            ? "Move photo earlier"
            : "Move photo later",
        );
    const meta = node(
        "small",
        file
          ? file.name + " · " + Math.ceil(file.size / 1024) + " KB"
          : "Unavailable file",
        "project-media-meta",
      ),
      image = thumbnail(ctx, file, row.caption),
      key = "media:" + ctx.projectId + ":" + row.id;
    if (partLibrary) {
      const isMain = current?.file_id === row.file_id;
      tile.classList.toggle("project-library-main", isMain);
      tile.dataset.mediaId = row.id;
      const canMain =
        file && PICTURE.test(file.content_type) && file.size <= 3 * 1024 * 1024;
      tile.draggable = !!canMain;
      tile.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData(
          "application/x-bs-part-photo",
          JSON.stringify({ projectId: ctx.projectId, itemId, mediaId: row.id }),
        );
        event.dataTransfer.effectAllowed = "copy";
      });
      const use = button("Use as main", () => selectMain(row), { small: true });
      use.disabled = !canMain;
      use.setAttribute(
        "aria-label",
        "Use " + (row.caption || file?.name || "photo") + " as main",
      );
      if (!canMain)
        use.title =
          "Main photos require a JPG, PNG or WebP image of at most 3 MB.";
      tile.append(
        isMain
          ? node("strong", "Main photo", "project-library-main-label")
          : use,
      );
    }
    tile.append(image);
    const controls = actionBar(image, {
      content: tools,
      expanded: opened.has(key),
      onToggle: (open) => {
        if (open) opened.add(key);
        else opened.delete(key);
      },
    });
    controls.panel.classList.add("project-photo-editor");
    tile.append(caption, meta, controls.panel);
    grid.append(tile);
  });
  const paste = fileDropTarget((incoming) => add(incoming), {
    label: "Paste a copied photo",
    text: "Drop photos or paste an image",
  });
  uploadRow.append(addButton, paste, mode.root);
  section.body.append(uploadRow, feedback.root, choose.input, grid);
  acceptDrops(section.body, add);
  return section.root;
}

// Every overview uses the shared bottom-right pencil. All management tools
// live inside its disclosure; no separate photo field or gallery section.
function photoControl(ctx, cover, tools, key) {
  const holder = node("div", "", "project-picture-holder");
  holder.append(cover);
  const controls = actionBar(cover, {
    content: tools,
    expanded: opened.has(key),
    onToggle: (open) => {
      if (open) opened.add(key);
      else opened.delete(key);
    },
  });
  holder.editorPanel = controls.panel;
  controls.panel.classList.add("project-photo-editor");
  return holder;
}

// The main slot selects a saved library image; it has no independent uploader.
export function partPicture(ctx, item) {
  const current = pictureFor(ctx.client.state, item.id),
    file = current ? fileOf(ctx, current) : null;
  const cover = file
    ? thumbnail(ctx, file, item.name)
    : node("p", "Drag a library photo here, or choose Use as main.", "muted");
  if (cover.tagName === "IMG") {
    cover.className = "project-picture";
    cover.loading = "eager";
  }
  let busy = false;
  const selectMain = async (row) => {
    if (busy) return;
    busy = true;
    ctx.notify("Setting main photo…");
    try {
      await ctx.client.write(ctx.projectId, "/media/main-picture", "POST", {
        itemId: item.id,
        mediaId: row.id,
      });
      if ((await ctx.refresh()) === false)
        throw Error(
          "Main photo saved, but the page could not refresh. Reload to see it.",
        );
      ctx.notify("Main photo saved. All photos remain in the library.");
    } catch (error) {
      ctx.notify(error.message);
    } finally {
      busy = false;
    }
  };
  const tools = node("div", "", "project-picture-tools");
  tools.append(
    node("h3", "Photo library"),
    node(
      "p",
      "Add photos here, then drag one onto the main picture or choose Use as main.",
      "muted",
    ),
  );
  if (current)
    tools.append(
      button(
        "Clear main",
        () =>
          send(
            ctx,
            "/media/" + current.id + "/remove",
            "POST",
            {},
            "Main photo cleared. The photo remains in the library.",
          ),
        { variant: "quiet", small: true },
      ),
    );
  tools.append(
    mediaGallery(ctx, {
      itemId: item.id,
      title: "Photo library",
      partLibrary: true,
      selectMain,
    }),
  );
  const holder = photoControl(ctx, cover, tools, ctx.projectId + ":" + item.id);
  wireMainPhotoSlot(
    holder.querySelector(".bs-photo-stage"),
    ctx,
    item.id,
    selectMain,
  );
  return holder;
}

// The same first gallery photo used by the project directory.
export function projectPicture(ctx, { assembly = null, gallery = false } = {}) {
  const photo = photosFor(ctx.client.state)[0],
    file = photo ? fileOf(ctx, photo) : null;
  const cover = file
    ? thumbnail(ctx, file, photo.caption || ctx.client.state.project.name)
    : node("p", "No picture yet", "muted");
  if (cover.tagName === "IMG") cover.className = "project-picture";
  const tools = node("div", "", "project-picture-tools");
  tools.append(mediaGallery(ctx, { title: "Project photos" }));
  // Keep the original top assembly's pictures accessible when its row is folded
  // into Project summary. They retain their original item and file IDs.
  if (assembly) {
    const group = node("div", "", "project-assembly-photo-tools");
    group.append(
      node("strong", "Top assembly · " + assembly.part_number),
      partPicture(ctx, assembly),
    );
    tools.append(group);
  }
  if (gallery) {
    const images = node("div", "", "project-summary-photo-grid");
    for (const photo of photosFor(ctx.client.state)) {
      const img = thumbnail(
        ctx,
        fileOf(ctx, photo),
        photo.caption || ctx.client.state.project.name,
      );
      img.className = "project-summary-photo";
      images.append(img);
    }
    if (!images.childElementCount) images.append(cover);
    const holder = photoControl(ctx, images, tools, ctx.projectId + ":");
    holder.style.setProperty(
      "--photo-count",
      String(Math.max(1, images.childElementCount)),
    );
    return holder;
  }
  return photoControl(ctx, cover, tools, ctx.projectId + ":");
}
