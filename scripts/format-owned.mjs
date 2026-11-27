// Grow this list as modern modules are cleaned up. Frozen legacy bundles keep
// their existing size guard until extracted; formatting must not bypass it.
import { readFile, writeFile } from "node:fs/promises";
import * as prettier from "prettier";
export const ownedModules = [
  "assets/automatic-backup-status.js",
  "assets/website-settings-page.js",
  "functions/api/automatic-backup-status.js",
  "assets/confirmation-dialog.js",
  "assets/photo-viewer.js",
  "assets/project-backup-settings.js",
  "assets/project-identity-link.js",
  "assets/project-part-history.js",
  "assets/project-bom-view.js",
  "assets/project-summary-cost.js",
  "assets/project-delete.js",
  "assets/project-instruction-model.js",
  "assets/project-summary-content.js",
  "assets/project-client.js",
  "assets/project-item-model.js",
  "assets/project-parts-view.js",
  "assets/project-html-export.js",
  "assets/project-tree-view.js",
  "assets/project-history-view.js",
  "assets/project-history-comparison.js",
  "assets/project-summary.js",
  "assets/project-editors.js",
  "assets/project-tree-model.js",
  "assets/project-overview-model.js",
  "assets/project-record-model.js",
  "assets/project-help.js",
  "assets/project-item-fields.js",
  "assets/project-catalog.js",
  "functions/api/project-selection-uses.js",
  "functions/api/project-engine.js",
  "functions/api/family-workshop-files.js",
  "functions/api/knowledge-archive.js",
  "functions/api/api-routes.js",
  "assets/lessons-model.js",
  "assets/lessons-learned.js",
  "functions/api/lessons-learned.js",
  "assets/project-directory.js",
  "assets/clipboard-files.js",
  "assets/photo-editor.js",
  "scripts/test-server.mjs",
  "assets/family-workshop.js",
  "assets/project-workspace.js",
  "assets/project-instructions.js",
  "assets/project-information.js",
  "assets/project-product-copy.js",
  "assets/project-signin.js",
  "functions/api/binary-data.js",
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
