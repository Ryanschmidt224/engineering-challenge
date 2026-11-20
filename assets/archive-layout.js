// Used by the Worker, the offline editor, the browser verifier and the local CLI.
globalThis.BSArchiveLayout = (() => {
 const collections = [
  "assembly-pages", "workspaces", "part-workspaces", "harnesses", "drawings",
  "component-thumbnails", "part-files", "part-pages", "recipe-files",
  "unstructured-notes", "part-revisions", "part-code", "assembly-status", "workspace-history"
 ];
 const records = ["trees", "components", "investigations", "project-numbering", "project-settings", "change-proposals"];
 const legacyLibraries = ["libraries/wires.json", "libraries/common-parts.json", "libraries/purchased-parts.json"];
 const profileKey = project => "project-profile/" + project + ".json";

 function folders(project) {
  const scoped = collection => collection + "/" + project + "/";
  const imageSources = [project + "/", scoped("component-thumbnails"), scoped("recipe-files")];
  const edits = ["photo-annotations/", "photo-renders/"].flatMap(prefix => imageSources.map(source => prefix + source));
  return [project + "/", ...collections.map(scoped), ...edits];
 }

 function singles(project) {
  return [...records.map(name => name + "/" + project + ".json"), ...legacyLibraries];
 }

 function isAllowedKey(project, key) {
  if (typeof key !== "string" || key.length > 1000 || /[\\\x00-\x1f\x7f]/.test(key)) return false;
  if (key.split("/").some(segment => !segment || segment === "." || segment === "..")) return false;
  return key.startsWith("workshop-dependencies/" + project + "/") || key === profileKey(project) || singles(project).includes(key) || folders(project).some(prefix => key.startsWith(prefix));
 }

 return Object.freeze({folders, singles, profileKey, isAllowedKey});
})();
