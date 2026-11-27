// Shared frame for confirmation, prompt and guarded project-action dialogs.
(() => {
  if (window.BSConfirmation) return;
  function frame(dialog, { title, content, actions, form = null }) {
    dialog.classList.add("bs-confirmation");
    const heading = document.createElement("h2");
    heading.className = "bs-confirmation-title";
    heading.textContent = title;
    heading.id = "confirmation-" + crypto.randomUUID();
    const header = document.createElement("div");
    header.className = "bs-confirmation-header";
    header.append(heading);
    const body = document.createElement("div");
    body.className = "bs-confirmation-body";
    body.append(content);
    actions.classList.add("bs-confirmation-actions");
    if (form) {
      form.replaceChildren(body, actions);
      dialog.replaceChildren(header, form);
    } else dialog.replaceChildren(header, body, actions);
    dialog.setAttribute("aria-labelledby", heading.id);
    dialog.setAttribute("aria-label", title);
    dialog.addEventListener(
      "close",
      () => dialog.classList.remove("bs-confirmation"),
      { once: true },
    );
  }
  function open({
    title = "Confirm action",
    message = "",
    confirmLabel = "Confirm",
    danger = false,
    notice = false,
    input = false,
    value = "",
    label = "",
    multiline = false,
    placeholder = "",
  } = {}) {
    return new Promise((resolve) => {
      const prior = document.activeElement,
        dialog = document.createElement("dialog"),
        content = document.createElement("div"),
        detail = document.createElement("p");
      detail.textContent = message;
      content.append(detail);
      let field;
      if (input) {
        const holder = document.createElement("label");
        holder.className = "bs-confirmation-field";
        holder.append(document.createTextNode(label || "Value"));
        field = document.createElement(multiline ? "textarea" : "input");
        field.className = "field";
        field.value = value ?? "";
        field.placeholder = placeholder;
        holder.append(field);
        content.append(holder);
      }
      const actions = document.createElement("div"),
        cancel = window.BSUI.button("Cancel"),
        confirm = window.BSUI.button(confirmLabel, undefined, {
          variant: danger ? "danger" : "primary",
        });
      if (danger) confirm.classList.add("bs-dialog-danger");
      cancel.hidden = notice;
      actions.append(cancel, confirm);
      frame(dialog, { title, content, actions });
      let finished = false;
      const finish = (ok) => {
        if (finished) return;
        finished = true;
        const answer = ok ? (input ? field.value : true) : input ? null : false;
        if (dialog.open) dialog.close();
        dialog.remove();
        if (prior?.isConnected) prior.focus();
        resolve(answer);
      };
      cancel.onclick = () => finish(false);
      confirm.onclick = () => finish(true);
      dialog.addEventListener("cancel", (e) => {
        e.preventDefault();
        finish(false);
      });
      dialog.addEventListener("close", () => finish(false));
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) finish(false);
      });
      if (field && !multiline)
        field.onkeydown = (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            finish(true);
          }
        };
      document.body.append(dialog);
      dialog.showModal();
      (field || (notice ? confirm : cancel)).focus();
    });
  }
  window.BSConfirmation = Object.freeze({ frame, open });
})();
