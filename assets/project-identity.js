export const projectNumber = (project) =>
  Number.isSafeInteger(project?.project_number) &&
  project.project_number >= 1001
    ? "P" + project.project_number
    : "";
export const projectLabel = (project) =>
  [projectNumber(project), project?.name || ""].filter(Boolean).join(" — ");
export const projectNameKey = (name) =>
  String(name || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
