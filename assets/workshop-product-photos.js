import { requestResult } from "./request-result.js";
import { actionBar, uploadPanel } from "./photo-editor.js";
import { node, button, panel } from "./workshop-ui.js?v=save-upload-20261128";

// Product photos use the existing Workshop attachment storage and shared upload
// controls. Stable upload IDs make a retry after a lost response safe.
export function workshopProductPhotos({
  product,
  attachments,
  canEdit,
  run,
  onChanged,
  onArchive,
  status,
}) {
  const section = panel("Photos"),
    list = node("ul", "", "attachment-list"),
    feedback = node("p", "", "muted"),
    retry = button("Retry upload", () => void save());
  section.classList.add("workshop-product-photos");
  section.querySelector(".panel-heading").classList.add("section-header");
  section.setAttribute("aria-label", "Product photos");
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  feedback.hidden = true;
  retry.hidden = true;
  let pending = [];

  for (const file of attachments.filter(
    (file) =>
      !file.archived && file.product_id === product.id && file.kind === "photo",
  )) {
    const row = node("li"),
      link = node("a", file.title),
      image = node("img", "", "photo-thumb");
    link.href = file.url || "/api/workshop/file?id=" + file.id;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    image.src = link.href;
    image.alt = file.title;
    row.append(image, link);
    if (canEdit)
      actionBar(image, {
        content: button(
          "Archive photo",
          () => void onArchive(file),
          "button--quiet",
        ),
      });
    list.append(row);
  }
  if (list.childElementCount) section.append(list);

  function message(text, error = false) {
    feedback.textContent = text;
    feedback.hidden = false;
    feedback.classList.toggle("status--error", error);
    status(text, error);
  }
  async function save(files) {
    if (files) {
      if (files.some((file) => !/\.(jpe?g|png|gif|webp)$/i.test(file.name))) {
        message("Choose a JPG, PNG, GIF or WebP photo.", true);
        return;
      }
      if (files.some((file) => file.size > 10 * 1024 * 1024)) {
        message("Each photo must be 10 MB or smaller.", true);
        return;
      }
      if (!files.length) return;
      if (pending.length) {
        message(
          "Finish the pending photo upload with Retry upload before choosing more photos.",
          true,
        );
        return;
      }
    }
    await run(async () => {
      if (files)
        pending = files.map((file) => ({ file, id: crypto.randomUUID() }));
      retry.hidden = true;
      section.setAttribute("aria-busy", "true");
      try {
        while (pending.length) {
          const { file, id } = pending[0];
          message("Uploading " + file.name + "…");
          await requestResult(
            "/api/workshop/file?owner=product&id=" +
              encodeURIComponent(product.id),
            {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "x-file-name": encodeURIComponent(file.name),
                "x-upload-id": id,
              },
              body: file,
            },
            { valid: (value) => value?.id === id },
          );
          pending.shift();
        }
      } catch (error) {
        message(
          (error.uncertain === false
            ? "Photo upload was rejected. "
            : "Photo upload is unconfirmed. Retry to finish. ") + error.message,
          true,
        );
        retry.textContent = "Retry upload";
        retry.hidden = false;
        return;
      } finally {
        section.removeAttribute("aria-busy");
      }
      try {
        await onChanged();
      } catch (error) {
        message(
          "Photos saved, but the list could not refresh. " + error.message,
          true,
        );
        retry.textContent = "Refresh photos";
        retry.hidden = false;
      }
    });
  }
  if (canEdit) {
    const upload = uploadPanel({
      title: "Add photos",
      accept: ".jpg,.jpeg,.png,.gif,.webp",
      onFiles: save,
      hint: "JPG, PNG, GIF or WebP, up to 10 MB each. Photos save immediately to this Workshop product.",
    });
    section
      .querySelector(".panel-heading")
      .append(button("+ Add photo", () => upload.open()));
    section.append(upload.panel);
  }
  section.append(feedback, retry);
  return section;
}
