import { node, field } from "./workshop-ui.js?v=save-upload-20261128";
const button = (...args) => window.BSUI.button(...args);
export function projectRestorePicker({ client, notify, onRestored }) {
  const input = node("input");
  input.type = "file";
  input.accept = ".bsproject,application/x-ndjson";
  input.setAttribute("aria-label", "Project backup");
  let copyName = "";
  const name = field(
      "New project name",
      copyName,
      (value) => (copyName = value),
      { required: true },
    ),
    nameInput = name.querySelector("input"),
    attempts = new WeakMap();
  const restore = button("Restore project backup", async () => {
    if (!input.files.length) {
      notify("Choose a project backup first.");
      return;
    }
    const title = copyName.trim();
    if (!title || title.length > 180) {
      notify("Enter a new project name of at most 180 characters.");
      nameInput.focus();
      return;
    }
    restore.disabled = true;
    input.disabled = true;
    nameInput.disabled = true;
    try {
      const file = input.files[0],
        first = (await file.slice(0, 4 * 1024 * 1024).text()).split("\n")[0],
        manifest = JSON.parse(first).manifest;
      if (!manifest?.project?.id)
        throw Error("This file has no project manifest.");
      let attempt = attempts.get(file);
      if (!attempt || attempt.name !== title) {
        attempt = {
          name: title,
          projectId: crypto.randomUUID(),
          operationId: crypto.randomUUID(),
        };
        attempts.set(file, attempt);
      }
      const result = await client.request(
        "/" +
          attempt.projectId +
          "/import-copy?" +
          new URLSearchParams({ name: title }),
        {
          method: "POST",
          headers: {
            "x-operation-id": attempt.operationId,
            "x-project-revision": "new",
          },
          body: file,
        },
      );
      await onRestored(result);
    } catch (error) {
      notify(error.message);
    } finally {
      restore.disabled = false;
      input.disabled = false;
      nameInput.disabled = false;
    }
  });
  const body = node("div", "", "ui-stack");
  body.append(name, input, restore);
  return body;
}
