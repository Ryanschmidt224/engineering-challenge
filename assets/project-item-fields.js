import { node, field } from "./workshop-ui.js?v=save-upload-20261128";
export const sourceChoices = [
  { value: "made", label: "Made in house" },
  { value: "purchased", label: "Purchased from outside vendor" },
];
export { projectStatusChoices as statusChoices } from "./project-item-model.js?v=cad-links-20261128";
export function fieldHelp(row, label, text) {
  const help = window.BSDialogs.helpButton("About " + label, text);
  help.setAttribute("aria-label", "About " + label);
  help.addEventListener("click", (event) => {
    event.preventDefault();
  });
  const caption = row.querySelector("label");
  if (caption) caption.append(help);
  else row.append(help);
  const input = row.querySelector("input");
  if (input) {
    input.setAttribute(
      "aria-label",
      caption?.firstChild?.textContent ||
        row.childNodes[1]?.textContent ||
        label,
    );
    input.title = text;
  }
}
export function purchaseFields(fields) {
  const area = node("div");
  for (const [key, label, type] of [
    ["vendor", "Outside vendor", "text"],
    ["supplier_number", "Supplier part number", "text"],
    ["order_url", "Order website", "url"],
    ["individual_cost", "Part Cost (individual)", "number"],
    ["bulk_cost", "Part Cost (bulk)", "number"],
    ["package_quantity", "Package quantity", "number"],
  ]) {
    const row = field(
      label,
      fields[key] ?? "",
      (value) => {
        if (value === null || value === "") delete fields[key];
        else fields[key] = value;
      },
      { type },
    );
    if (type === "number") {
      row.querySelector("input").min = key === "package_quantity" ? "1" : "0";
    }
    area.append(row);
  }
  return area;
}
export function customFields(specs) {
  const area = node("div"),
    list = node("div"),
    add = window.BSUI.button("Add field", () => {
      specs.push({ field_id: crypto.randomUUID(), label: "", value: "" });
      render();
      list.lastChild.querySelector("input").focus();
    });
  const render = () => {
    list.replaceChildren();
    for (const spec of specs) {
      const row = field(
          "Details",
          spec.value ?? "",
          (value) => (spec.value = value),
          { type: typeof spec.value === "number" ? "number" : "text" },
        ),
        details = row.querySelector("input"),
        prompt = node("input", "", "field project-custom-prompt");
      prompt.value = spec.label;
      prompt.placeholder = "Prompt";
      prompt.setAttribute("aria-label", "Field prompt");
      prompt.maxLength = 100;
      prompt.oninput = () => {
        spec.label = prompt.value;
        details.setAttribute("aria-label", spec.label || "Field details");
      };
      details.setAttribute("aria-label", spec.label || "Field details");
      details.placeholder = "Details";
      // Older typed values/units remain untouched until explicitly edited.
      if (typeof spec.value === "boolean" || spec.value === null) {
        details.value = spec.value === null ? "" : String(spec.value);
      }
      const remove = window.BSUI.button(
        "×",
        () => {
          specs.splice(specs.indexOf(spec), 1);
          render();
        },
        { variant: "quiet", small: true },
      );
      remove.setAttribute("aria-label", "Remove field");
      const valueArea = node("div", "", "project-custom-value");
      valueArea.append(details, remove);
      row.replaceChildren(prompt, valueArea);
      list.append(row);
    }
  };
  area.append(list, add);
  render();
  return area;
}
