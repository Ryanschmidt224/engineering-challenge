import { projectLabel, projectNameKey } from "./project-identity.js";
export function projectNameConfirmation(
  ctx,
  excludeId,
  nameInput,
  originalName = null,
) {
  let approved = null;
  return async (data) => {
    if (originalName !== null && data.name.trim() === originalName) return true;
    const { projects } = await ctx.client.request("");
    const name = projectNameKey(data.name);
    const matches = projects.filter(
      (project) =>
        project.id !== excludeId && projectNameKey(project.name) === name,
    );
    if (!matches.length) {
      approved = null;
      return true;
    }
    const signature = JSON.stringify([
      name,
      matches.map((project) => project.id).sort(),
    ]);
    if (signature === approved) return true;
    const keep = await window.BSDialogs.confirm(
      "A project named “" +
        data.name.trim() +
        "” already exists: " +
        matches.slice(0, 5).map(projectLabel).join("; ") +
        (matches.length > 5 ? "; and " + (matches.length - 5) + " more" : "") +
        ". Change the name, or keep both with separate permanent project numbers.",
      {
        title: "Project name already used",
        confirmLabel: "Keep same name",
        cancelLabel: "Change name",
      },
    );
    if (keep) approved = signature;
    else
      requestAnimationFrame(() => {
        nameInput().focus();
        nameInput().select();
      });
    return keep;
  };
}
