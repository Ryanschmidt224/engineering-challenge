// Grow this list as modern modules are cleaned up. Frozen legacy bundles keep
// their existing size guard until extracted; formatting must not bypass it.
import { readFile, writeFile } from "node:fs/promises";
import * as prettier from "prettier";
export const ownedModules = [
  "assets/project-directory.js",
  "assets/clipboard-files.js",
  "assets/photo-editor.js",
  "scripts/test-server.mjs",
  "assets/family-workshop.js",
  "assets/knowledge.js",
  "assets/project-workspace.js",
  "assets/project-instructions.js",
  "assets/project-information.js",
  "assets/project-product-copy.js",
  "assets/project-signin.js",
  "functions/api/binary-data.js",
  "functions/api/knowledge.js",
  "functions/api/knowledge-targets.js",
  "functions/api/private-access.js",
  "worker.js",

  "assets/family-model.js",
  "assets/file-selection.js",
  "assets/project-media.js",
  "assets/project-record-attachments.js",
  "assets/project-workshop-editor.js",
  "assets/site-header.js",
  "assets/website-settings-client.js",
  "assets/workshop-lookup-documents.js",
  "assets/workshop-lookup-evidence-view.js",
  "assets/workshop-lookup-model.js",
  "assets/workshop-lookup-provenance.js",
  "assets/workshop-product-lookup.js",
  "functions/api/project-workshop.js",
  "functions/api/workshop-db.js",
  "functions/api/workshop-document-completion.js",
  "functions/api/workshop-lookup-template.js",
  "functions/api/workshop-lookup.js",
  "functions/api/workshop-template-result.js",
  "functions/api/workshop-migrations.js",
  "scripts/workshop-backup.mjs",
  "scripts/format-owned.mjs",
];
const write = process.argv.includes("--write"),
  failures = [];
for (const file of ownedModules) {
  const source = await readFile(file, "utf8"),
    options = { filepath: file };
  if (write) await writeFile(file, await prettier.format(source, options));
  else if (!(await prettier.check(source, options))) failures.push(file);
}
if (failures.length) {
  console.error(
    "Format these owned modules with npm run format:js:\n" +
      failures.join("\n"),
  );
  process.exitCode = 1;
} else
  console.log(
    `${write ? "Formatted" : "Checked"} ${ownedModules.length} owned JavaScript modules.`,
  );
