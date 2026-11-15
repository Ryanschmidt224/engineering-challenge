# Building Schmidt — architecture and cleanup contract

## Applications
- **Projects** — `functions/api/projects.js` owns project catalog authorization and persistence. `functions/api/project-seed.js` contains built-in project seed data. Project trees, BOMs, work instructions, revisions, and files are stored in distinct R2 namespaces under stable project IDs.
- **Knowledge Base** — `assets/knowledge-seed.js` owns the initial topic content and classifications. `assets/site.js` renders the legacy knowledge experience and navigation. Browser-local notes and drafts must not be confused with server-side records.
- **Workshop shared catalog** — `assets/resources.js` supplies curated generic references; `functions/api/workshop-reference.js` stores administrator-owned overrides, photos and ordering fields. `assets/workshop-model.js` owns classification, matching and stock-label logic.
- **Workshop private inventory** — `functions/api/personal-workshop.js` enforces account ownership for individual equipment and stock statuses. A `catalogId` links an inventory item to a shared catalog reference; it never grants permission to edit the shared record.
- **Workshop UI** — `assets/personal-workshop.js` renders the browsing/editor workflows. `assets/workshop.css` owns Workshop layout. The `assets/catalog-ui.js` shell is shared by top-level pages only.
- **Accounts and authorization** — `functions/api/accounts.js` and `functions/api/auth.js` own authenticated sessions and the administrator role. The administrator password migration is not a shortcut for public registration.
- **Worker** — `worker.js` is a route adapter, not a data store. It must not permit a private project's assets to be read without authorization.

## Contracts
1. Preserve immutable record IDs across Projects, BOMs, Knowledge references and Workshop records. Do not use display names as primary keys.
2. Keep public catalog overrides separate from private user inventory; never copy private user data into public responses.
3. Every API write requires server-side authorization and schema validation. Client controls are not access control.
4. Every persistent schema change requires a migration strategy, schema version, and regression test.
5. Use one styling source per subsystem. Do not append new overriding copies of obsolete CSS.
6. No UI change can be called validated solely because source parses. Test navigation, authorization, data round-trips and deployment separately.

## Testing
- `npm run check` executes syntax checks and all `node:test` regressions.
- `.github/workflows/ci.yml` runs the same command on pushes and pull requests.
- `tests/project-ownership.test.mjs`: project authorization, archive behavior, and account roles.
- `tests/workshop-integration.test.mjs`: shared edit authorization, personal inventory isolation and validation.
- `tests/workshop-model.test.mjs`: classification, catalog matching and stock labels.
- `tests/architecture.test.mjs`: scripts, stylesheets, Worker imports, and architecture boundaries.
- `tests/content-reset.test.mjs`: guarded destructive reset scope and backup requirement.

## Data retirement
Code is versioned in GitHub. R2 data is not part of GitHub history. The pre-cleanup code is preserved on branch `archive/pre-structural-cleanup-2026-11-14`.

**No live data purge has been performed.** A purge needs a separate, independently verified offsite R2 backup and operator-level access to the Cloudflare R2 binding. `scripts/content-reset.mjs` is an operator-only helper; it is not imported into the deployed Worker or exposed over HTTP. It inventories allowlisted content and refuses deletion of accounts, administrator role mappings, and backups.

The original site contains seed projects and seeded Knowledge topics in source. Removing R2 objects by itself does not remove those seeds. In addition, browser localStorage notes or drafts cannot be deleted remotely from Cloudflare R2. Decide separately whether to retire those seeds and local state after verifying replacement screens.

## Outstanding modernization before claiming full cleanup
- Replace legacy hidden Workshop reference-tree dependencies in `assets/resources.js` and `index.html` only after migration tests cover saved wires, purchased items and part pickers.
- Split the remaining large `assets/project-manager.js` and `assets/site.js` controllers at stable boundaries; do not delete routes their screens still call.
- Add browser end-to-end tests for project editing, BOM save, account registration and Workshop photo upload.
- Verify Cloudflare deployment, API responses, R2 permissions, migration, and recovery on staging before promoting to production.
