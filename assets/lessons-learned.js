// Lessons Learned page (browser). Mount with: initLessons(document.getElementById("lessons-learned")).
//
// One list on the left (Add lesson, search, quality filter), one lesson on
// the right, shown either as a read view or as the edit form. All text is put
// on the page with textContent; nothing written by the owner is parsed as HTML.
//
// The edit form is NOT re-rendered while typing (that would lose the cursor).
// Typing updates the draft in place; only structural actions (add / move /
// remove a step, photos, resolution) re-render the form.
import {
  qualities,
  titleOf,
  nameKey,
  isBlank,
  qualityOf,
  segments,
  titleIndex,
  backlinksOf,
  filterBits,
  insertStep,
  moveStep,
  emptyStep,
  limits,
} from "./lessons-model.js";
import { fileDropTarget } from "./file-selection.js";
import { mediaUploadFeedback } from "./media-upload-feedback.js";

const api = "/api/lessons-learned";
const newId = () => crypto.randomUUID();
const copy = (value) => structuredClone(value);
const photoUrl = (id) => api + "/photo?id=" + encodeURIComponent(id);
// Literal class names (the CSS producer check needs every class written out).
const dotClass = {
  yes: "ib-dot ib-dot--yes",
  meh: "ib-dot ib-dot--meh",
  no: "ib-dot ib-dot--no",
  none: "ib-dot",
};
const qualityLabel = Object.fromEntries(
  qualities.map((q) => [q.value, q.label]),
);

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "value") el.value = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat())
    if (child !== null && child !== undefined && child !== false)
      el.append(
        typeof child === "string" ? document.createTextNode(child) : child,
      );
  return el;
}

async function request(path, method = "GET", payload) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    ...(payload === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Error(
      data.error ||
        "Request failed (HTTP " +
          response.status +
          "). Your draft is preserved.",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}

async function uploadPhoto(bitId, file, id) {
  // Same upload ID on retry: the server treats a repeat as the same photo.
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(
        api + "/photo?bit=" + encodeURIComponent(bitId),
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "x-file-name": encodeURIComponent(file.name),
            "x-upload-id": id,
          },
          body: file,
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw Object.assign(Error(data.error || "Upload failed"), {
          status: response.status,
        });
      return data;
    } catch (error) {
      if (attempt >= 2 || (error.status && error.status < 500)) throw error;
    }
  }
}

export function initLessons(root) {
  const state = {
    bits: [],
    photos: new Map(), // id -> {id, bit_id, title}
    previews: new Map(), // photo id -> object URL, for photos uploaded this session
    selected: new URLSearchParams(location.search).get("bit") || "",
    draft: null, // {record, expectedRevision, dirty}
    search: "",
    quality: "",
    busy: false,
    archiveView: false,
    paused: false,
  };

  const listPane = h("aside", {
    class: "ib-list",
    "aria-label": "Lessons Learned",
  });
  const mainPane = h("main", { class: "ib-main" });
  const statusLine = h("p", {
    class: "ib-status",
    hidden: true,
    role: "status",
    "aria-live": "polite",
  });
  root.replaceChildren(
    statusLine,
    h("div", { class: "ib-layout" }, listPane, mainPane),
  );

  const say = (message, error = false) => {
    statusLine.textContent = message;
    statusLine.hidden = !message;
    statusLine.classList.toggle("ib-status--error", error);
  };
  const current = () => state.bits.find((b) => b.id === state.selected);
  let timer, saving;
  let refreshList = () => {};
  const draftKey = "bs-lessons-draft";
  function rememberLocation() {
    const url = new URL(location.href);
    state.selected
      ? url.searchParams.set("bit", state.selected)
      : url.searchParams.delete("bit");
    history.replaceState(null, "", url);
  }
  function persistDraft() {
    try {
      state.draft?.dirty
        ? sessionStorage.setItem(draftKey, JSON.stringify(state.draft))
        : sessionStorage.removeItem(draftKey);
    } catch {
      /* The in-memory draft and unload guard remain available. */
    }
  }
  function mark() {
    state.draft.dirty = true;
    state.draft.version = (state.draft.version || 0) + 1;
    persistDraft();
    clearTimeout(timer);
    if (!state.paused)
      timer = setTimeout(() => {
        if (!state.busy) save().catch(saveFailed);
      }, 700);
  }
  function saveFailed(error) {
    state.paused = true;
    persistDraft();
    say(error.message + " Your draft is kept in this tab.", true);
    renderMain();
  }

  window.addEventListener("beforeunload", (event) => {
    if (state.draft?.dirty) event.preventDefault();
  });

  async function load() {
    const [live, archived] = await Promise.all([
      request(api),
      request(api + "?archived=1"),
    ]);
    state.bits = [...live.bits, ...archived.bits];
    state.photos = new Map(
      [...live.photos, ...archived.photos].map((p) => [p.id, p]),
    );
    if (!state.draft) {
      try {
        const draft = JSON.parse(sessionStorage.getItem(draftKey));
        if (draft?.record?.id && draft.dirty) {
          state.draft = draft;
          state.selected = draft.record.id;
          state.paused = true;
          say(
            "Recovered your unsaved draft. Retry saving, or load the saved lesson.",
            true,
          );
        }
      } catch {}
    }
    if (!current() && !state.draft)
      state.selected = state.bits.find((b) => !b.archived)?.id || "";
    render();
  }

  function remember(record) {
    const index = state.bits.findIndex((b) => b.id === record.id);
    if (index < 0) state.bits = [record, ...state.bits];
    else state.bits = state.bits.map((b) => (b.id === record.id ? record : b));
  }

  function select(id, { edit = false } = {}) {
    if (state.busy || id === state.selected) return;
    return run(async () => {
      await save();
      state.selected = id;
      state.draft = null;
      state.paused = false;
      persistDraft();
      rememberLocation();
      if (edit) startEditing();
      render();
    });
  }

  function startEditing() {
    const bit = current();
    if (!bit) return;
    say("");
    state.draft = {
      record: {
        id: bit.id,
        happened: bit.happened,
        steps: copy(bit.steps),
        resolution: copy(bit.resolution),
      },
      expectedRevision: bit.revision,
      dirty: false,
      version: 0,
    };
  }

  function addBit(happened = "") {
    return run(async () => {
      await save();
      const record = {
        id: newId(),
        happened,
        steps: [emptyStep(newId())],
        resolution: null,
      };
      state.draft = {
        record,
        expectedRevision: null,
        dirty: !!happened,
        version: 0,
      };
      state.selected = record.id;
      state.archiveView = false;
      state.paused = false;
      say("");
      rememberLocation();
      persistDraft();
      render();
      mainPane.querySelector("textarea")?.focus();
      if (happened) mark();
    });
  }

  async function save({ force = false } = {}) {
    clearTimeout(timer);
    if (saving) await saving;
    const draft = state.draft;
    if (
      !draft ||
      (!draft.dirty && draft.expectedRevision !== null) ||
      (!force && draft.expectedRevision === null && isBlank(draft.record))
    )
      return;
    if (state.paused)
      throw Error("Saving is paused. Retry saving or load the saved lesson.");
    const pending = draft.pending || {
      record: copy(draft.record),
      expectedRevision: draft.expectedRevision,
      operationId: newId(),
      version: draft.version || 0,
    };
    draft.pending = pending;
    persistDraft();
    say("Saving…");
    const task = (async () => {
      let data;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          data = await request(api, "POST", {
            record: pending.record,
            expectedRevision: pending.expectedRevision,
            operationId: pending.operationId,
          });
          break;
        } catch (error) {
          if (attempt || (error.status && error.status < 500)) throw error;
        }
      }
      remember(data.record);
      refreshList();
      draft.expectedRevision = data.record.revision;
      draft.pending = null;
      draft.dirty = (draft.version || 0) !== pending.version;
      persistDraft();
      say(draft.dirty ? "Saving…" : "");
    })();
    saving = task;
    try {
      await task;
    } finally {
      if (saving === task) saving = null;
    }
    if (state.draft === draft && draft.dirty) await save();
  }

  async function run(action) {
    if (state.busy) return;
    state.busy = true;
    root.setAttribute("aria-busy", "true");
    root.inert = true;
    try {
      await action();
    } catch (error) {
      saveFailed(error);
    } finally {
      state.busy = false;
      root.setAttribute("aria-busy", "false");
      root.inert = false;
    }
  }

  const done = () =>
    run(async () => {
      const { record, expectedRevision } = state.draft;
      if (isBlank(record) && expectedRevision === null) {
        state.draft = null;
        state.selected = state.bits.find((b) => !b.archived)?.id || "";
        persistDraft();
        rememberLocation();
        render();
        return;
      }
      await save();
      state.draft = null;
      persistDraft();
      rememberLocation();
      say("");
      render();
    });

  async function archive(id, expectedRevision) {
    const data = await request(api, "PATCH", {
      id,
      archived: true,
      expectedRevision,
      operationId: newId(),
    });
    remember(data.record);
  }

  const removeBit = () =>
    run(async () => {
      const { record, expectedRevision } = state.draft;
      if (
        !window.confirm(
          "Archive this lesson? You can restore it from Archived.",
        )
      )
        return;
      if (expectedRevision !== null) {
        await save();
        await archive(record.id, state.draft.expectedRevision);
      }
      state.draft = null;
      state.selected = state.bits.find((b) => !b.archived)?.id || "";
      persistDraft();
      rememberLocation();
      say("Lesson archived. Open Archived to restore it.");
      render();
    });

  const uploadFeedback = mediaUploadFeedback();
  const addPhotos = (step, incoming) =>
    run(async () => {
      const files = [...incoming];
      if (step.photos.length + files.length > limits.photosPerStep)
        throw Error(
          "A step can have at most " + limits.photosPerStep + " photos.",
        );
      if (
        files.some(
          (file) =>
            !/^image\/(jpeg|png|gif|webp)$/.test(file.type) ||
            file.size > 10 * 1024 * 1024,
        )
      )
        throw Error("Choose JPG, PNG, GIF or WebP photos of at most 10 MB.");
      await save({ force: true });
      uploadFeedback.update({ phase: "uploading", images: files });
      renderMain();
      try {
        for (const file of files) {
          const id = newId();
          say("Uploading " + file.name + "…");
          await uploadPhoto(state.draft.record.id, file, id);
          state.previews.set(id, URL.createObjectURL(file));
          state.photos.set(id, {
            id,
            bit_id: state.draft.record.id,
            title: file.name,
          });
          step.photos.push(id);
          mark();
          renderMain();
        }
        uploadFeedback.update({ phase: "saving" });
        await save();
        uploadFeedback.update({ phase: "complete" });
        uploadFeedback.root.hidden = true;
        say("");
      } catch (error) {
        uploadFeedback.update({ phase: "error", message: error.message });
        throw error;
      }
    });

  // ---------- list ----------
  function renderList() {
    const list = h("div", { class: "ib-list__items" });
    const renderItems = () => {
      const shown = filterBits(
        state.bits.filter((bit) => !!bit.archived === state.archiveView),
        {
          search: state.search,
          quality: state.quality,
        },
      );
      list.replaceChildren(
        ...shown.map((bit) =>
          h(
            "button",
            {
              type: "button",
              class:
                "ib-list__item" +
                (bit.id === state.selected ? " is-selected" : ""),
              "aria-current": bit.id === state.selected ? "true" : null,
              onclick: () => select(bit.id),
            },
            h("span", {
              class: dotClass[qualityOf(bit)],
              "aria-hidden": "true",
            }),
            h("span", { text: titleOf(bit) || "New lesson" }),
          ),
        ),
      );
      if (!shown.length)
        list.append(
          h("p", {
            class: "ib-muted",
            text: state.bits.length ? "Nothing matches." : "No lessons yet.",
          }),
        );
    };
    refreshList = renderItems;
    const search = h("input", {
      type: "search",
      class: "ib-input",
      placeholder: "Search",
      "aria-label": "Search lessons",
      value: state.search,
      oninput: (e) => {
        state.search = e.target.value;
        renderItems();
      },
    });
    const filter = h(
      "select",
      {
        class: "ib-input",
        onchange: (e) => {
          state.quality = e.target.value;
          renderItems();
        },
      },
      h("option", { value: "", text: "Any" }),
      qualities.map((q) => h("option", { value: q.value, text: q.label })),
      h("option", { value: "none", text: "Not rated" }),
    );
    filter.value = state.quality;
    listPane.replaceChildren(
      h("button", {
        type: "button",
        class: "button button--primary ib-add",
        onclick: () => addBit(),
        text: "+ Add lesson",
      }),
      h("button", {
        type: "button",
        class: "ib-text-button",
        text: state.archiveView ? "Active lessons" : "Archived",
        onclick: () =>
          run(async () => {
            await save();
            state.draft = null;
            state.archiveView = !state.archiveView;
            state.selected =
              state.bits.find((b) => !!b.archived === state.archiveView)?.id ||
              "";
            rememberLocation();
            render();
          }),
      }),
      search,
      h("label", { class: "ib-filter" }, "Quality ", filter),
      list,
    );
    renderItems();
  }

  // ---------- read view ----------
  function linkedText(tag, className, value) {
    const index = titleIndex(state.bits);
    const el = h(tag, { class: className });
    for (const part of segments(
      value,
      (name) => index.get(nameKey(name)) || null,
    )) {
      if (part.kind === "text") el.append(part.text);
      else
        el.append(
          h("button", {
            type: "button",
            class: "ib-link" + (part.target ? "" : " ib-link--new"),
            title: part.target
              ? "Open " + part.name
              : "Start a new lesson called " + part.name,
            text: part.text,
            onclick: () =>
              part.target ? select(part.target.id) : addBit(part.name),
          }),
        );
    }
    return el;
  }

  function photoImg(id, className) {
    const photo = state.photos.get(id);
    return h("img", {
      class: className,
      src: state.previews.get(id) || photoUrl(id),
      alt: photo?.title || "Photo",
      loading: "lazy",
    });
  }

  function renderView(bit) {
    const shown = bit.steps.filter(
      (s) =>
        s.question.trim() ||
        s.hypothesis.trim() ||
        s.result.trim() ||
        s.photos.length,
    );
    const back = backlinksOf(bit, state.bits);
    const quality = bit.resolution?.quality;
    return h(
      "article",
      { class: "ib-view" },
      h(
        "div",
        { class: "ib-view__head" },
        linkedText("h2", "ib-view__title", titleOf(bit) || "New lesson"),
        h("button", {
          type: "button",
          class: "ib-text-button",
          text: bit.archived ? "Restore" : "Edit",
          onclick: () => {
            if (bit.archived)
              run(async () => {
                const data = await request(api, "PATCH", {
                  id: bit.id,
                  archived: false,
                  expectedRevision: bit.revision,
                  operationId: newId(),
                });
                remember(data.record);
                state.archiveView = false;
                render();
                say("Lesson restored.");
              });
            else {
              startEditing();
              render();
            }
          },
        }),
      ),
      bit.happened.includes("\n")
        ? linkedText(
            "p",
            "ib-step__result",
            bit.happened.split("\n").slice(1).join("\n"),
          )
        : null,
      shown.length
        ? h(
            "ol",
            { class: "ib-steps" },
            shown.map((s, i) =>
              h(
                "li",
                { class: "ib-step" },
                h("span", { class: "ib-step__label", text: "Step " + (i + 1) }),
                linkedText(
                  "h2",
                  "ib-step__question",
                  s.question || "Step " + (i + 1),
                ),
                s.hypothesis.trim()
                  ? linkedText(
                      "p",
                      "ib-step__hypothesis",
                      "Hypothesis: " + s.hypothesis,
                    )
                  : null,
                s.result.trim()
                  ? linkedText("p", "ib-step__result", s.result)
                  : null,
                s.photos.length
                  ? h(
                      "div",
                      { class: "ib-photos" },
                      s.photos.map((id) =>
                        h(
                          "a",
                          {
                            href: photoUrl(id),
                            target: "_blank",
                            rel: "noopener noreferrer",
                            "aria-label":
                              "Open photo " +
                              (state.photos.get(id)?.title || ""),
                          },
                          photoImg(id, "ib-photo"),
                        ),
                      ),
                    )
                  : null,
              ),
            ),
          )
        : h("p", {
            class: "ib-muted",
            text: "No steps yet. Click Edit to add one.",
          }),
      bit.resolution && (bit.resolution.text.trim() || quality)
        ? h(
            "section",
            { class: "ib-resolution" },
            h("span", { class: "ib-step__label", text: "Resolution" }),
            bit.resolution.text.trim()
              ? linkedText("p", "ib-step__result", bit.resolution.text)
              : null,
            quality
              ? h(
                  "p",
                  { class: "ib-quality" },
                  h("span", {
                    class: dotClass[quality],
                    "aria-hidden": "true",
                  }),
                  "Quality technical writeup: ",
                  h("strong", { text: qualityLabel[quality] }),
                )
              : null,
          )
        : null,
      back.length
        ? h(
            "p",
            { class: "ib-backlinks" },
            "Linked from ",
            back.flatMap((other, i) => [
              i ? ", " : "",
              h("button", {
                type: "button",
                class: "ib-link",
                text: titleOf(other),
                onclick: () => select(other.id),
              }),
            ]),
          )
        : null,
    );
  }

  // ---------- edit form ----------
  function field(
    label,
    value,
    { multiline = false, rows = 3, placeholder = "", onInput },
  ) {
    const id = "lesson-field-" + newId();
    const control = multiline
      ? h("textarea", {
          class: "field",
          id,
          rows,
          placeholder,
          value,
        })
      : h("input", {
          class: "field",
          id,
          placeholder,
          value,
        });
    control.addEventListener("input", (e) => {
      onInput(e.target.value);
      mark();
    });
    return h(
      "div",
      { class: "field-row" },
      h("label", { for: id, text: label }),
      control,
    );
  }

  const divider = (onclick) =>
    h(
      "div",
      { class: "ib-divider" },
      h("button", {
        type: "button",
        class: "button",
        text: "+ Add a step",
        onclick,
      }),
    );

  function renderForm() {
    const record = state.draft.record;
    const restructure = (change) => {
      change();
      mark();
      renderMain();
    };
    const parts = [
      h("h2", {
        class: "ib-form__title",
        text:
          state.draft.expectedRevision === null ? "New lesson" : "Edit lesson",
      }),
      h(
        "section",
        { class: "ui-editor-group", "aria-label": "Lesson introduction" },
        h("h2", { class: "ui-editor-group__heading", text: "Lesson details" }),
        field("What happened?", record.happened, {
          multiline: true,
          rows: 2,
          placeholder:
            "e.g. My 28 V buck converter blew up when I switched on a 24 V supply.",
          onInput: (v) => (record.happened = v),
        }),
      ),
    ];
    record.steps.forEach((step, i) => {
      if (i > 0)
        parts.push(
          divider(() =>
            restructure(
              () =>
                (record.steps = insertStep(
                  record.steps,
                  i,
                  emptyStep(newId()),
                )),
            ),
          ),
        );
      const fileInput = h("input", {
        type: "file",
        accept: "image/jpeg,image/png,image/gif,image/webp",
        multiple: true,
        class: "ib-file",
        hidden: true,
        onchange: (e) => {
          const files = [...e.target.files];
          e.target.value = "";
          if (files.length) addPhotos(step, files);
        },
      });
      parts.push(
        h(
          "section",
          { class: "ui-editor-group", "aria-label": "Step " + (i + 1) },
          h(
            "div",
            { class: "ui-editor-group__heading ib-step__tools" },
            h("h2", {
              class: "ui-editor-group__title",
              text: "Step " + (i + 1),
            }),
            h("button", {
              type: "button",
              class: "button ib-icon-button",
              "aria-label": "Move step " + (i + 1) + " up",
              text: "↑",
              disabled: i === 0,
              onclick: () =>
                restructure(
                  () => (record.steps = moveStep(record.steps, i, -1)),
                ),
            }),
            h("button", {
              type: "button",
              class: "button ib-icon-button",
              "aria-label": "Move step " + (i + 1) + " down",
              text: "↓",
              disabled: i === record.steps.length - 1,
              onclick: () =>
                restructure(
                  () => (record.steps = moveStep(record.steps, i, 1)),
                ),
            }),
            h("button", {
              type: "button",
              class: "ib-text-button ib-text-button--quiet",
              text: "Remove",
              onclick: () => {
                const written =
                  step.question ||
                  step.hypothesis ||
                  step.result ||
                  step.photos.length;
                if (written && !window.confirm("Remove step " + (i + 1) + "?"))
                  return;
                restructure(
                  () => (record.steps = record.steps.filter((s) => s !== step)),
                );
              },
            }),
          ),
          field("What is the question?", step.question, {
            placeholder: "e.g. Why did it fail below its rating?",
            onInput: (v) => (step.question = v),
          }),
          field("Hypothesis?", step.hypothesis, {
            placeholder: "What you think is going on",
            onInput: (v) => (step.hypothesis = v),
          }),
          field("What did you test or learn?", step.result, {
            multiline: true,
            placeholder:
              "What you measured, tried or found out. [[Name]] links another lesson.",
            onInput: (v) => (step.result = v),
          }),
          h(
            "div",
            { class: "ib-photos" },
            step.photos.map((id) =>
              h(
                "button",
                {
                  type: "button",
                  class: "ib-photo-remove",
                  title: "Remove photo",
                  "aria-label":
                    "Remove photo " + (state.photos.get(id)?.title || ""),
                  onclick: () =>
                    restructure(
                      () => (step.photos = step.photos.filter((p) => p !== id)),
                    ),
                },
                photoImg(id, "ib-photo ib-photo--small"),
              ),
            ),
            h("button", {
              type: "button",
              class: "button ib-add-photo",
              text: "+ Add photo",
              onclick: () => fileInput.click(),
            }),
            fileInput,
            fileDropTarget((files) => addPhotos(step, files), {
              label: "Paste a lesson photo",
              text: "Drop photos or paste an image",
            }),
          ),
        ),
      );
    });
    parts.push(
      divider(() => restructure(() => record.steps.push(emptyStep(newId())))),
    );

    if (record.resolution) {
      const name = "quality-" + record.id;
      parts.push(
        h(
          "section",
          {
            class: "ui-editor-group",
            "aria-label": "Resolution",
          },
          h(
            "div",
            { class: "ui-editor-group__heading ib-step__tools" },
            h("h2", { class: "ui-editor-group__title", text: "Resolution" }),
            h("button", {
              type: "button",
              class: "ib-text-button ib-text-button--quiet",
              text: "Remove",
              onclick: () => restructure(() => (record.resolution = null)),
            }),
          ),
          field("What was the resolution?", record.resolution.text, {
            multiline: true,
            placeholder:
              "How it ended: the fix, the answer, or what you'd do next time.",
            onInput: (v) => (record.resolution.text = v),
          }),
          h(
            "fieldset",
            { class: "ib-choice" },
            h("legend", { text: "This is a quality technical writeup" }),
            qualities.map((q) => {
              const input = h("input", {
                type: "radio",
                name,
                value: q.value,
                onchange: () => {
                  record.resolution.quality = q.value;
                  mark();
                },
              });
              input.checked = record.resolution.quality === q.value;
              return h("label", {}, input, " " + q.label);
            }),
          ),
        ),
      );
    } else {
      parts.push(
        h("button", {
          type: "button",
          class: "button ib-add-resolution",
          text: "+ Resolution",
          onclick: () =>
            restructure(
              () => (record.resolution = { text: "", quality: null }),
            ),
        }),
      );
    }

    parts.push(uploadFeedback.root);
    if (state.paused)
      parts.push(
        h(
          "div",
          { class: "ib-recovery" },
          h("button", {
            type: "button",
            class: "button",
            text: "Retry saving",
            onclick: () =>
              run(async () => {
                state.paused = false;
                await save();
                renderMain();
              }),
          }),
          h("button", {
            type: "button",
            class: "button",
            text: "Copy my draft",
            onclick: () =>
              navigator.clipboard
                .writeText(JSON.stringify(record, null, 2))
                .then(() => say("Draft copied.")),
          }),
          h("button", {
            type: "button",
            class: "button",
            text: "Load saved lesson",
            onclick: () =>
              run(async () => {
                if (
                  !window.confirm(
                    "Discard this draft and load the saved lesson?",
                  )
                )
                  return;
                state.draft = null;
                state.paused = false;
                persistDraft();
                say("");
                await load();
              }),
          }),
        ),
      );
    parts.push(
      h(
        "div",
        { class: "ib-form__footer" },
        h("button", {
          type: "button",
          class: "ib-text-button ib-text-button--danger",
          text: "Archive",
          onclick: removeBit,
        }),
        statusLine,
        h("button", {
          type: "button",
          class: "button button--primary",
          text: "Done",
          onclick: done,
        }),
      ),
    );
    return h(
      "form",
      {
        class: "ib-form ui-editor-fields",
        onsubmit: (e) => e.preventDefault(),
      },
      parts,
    );
  }

  function renderMain() {
    if (state.draft) {
      // Keep scroll position across structural re-renders of the form.
      const y = window.scrollY;
      mainPane.replaceChildren(renderForm());
      window.scrollTo(0, y);
      return;
    }
    root.prepend(statusLine);
    const bit = current();
    mainPane.replaceChildren(
      bit
        ? renderView(bit)
        : h("p", { class: "ib-muted", text: "Click Add lesson to start." }),
    );
  }

  function render() {
    renderList();
    renderMain();
  }

  run(load);
}
