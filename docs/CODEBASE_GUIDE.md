# Building Schmidt — Codebase Guide

This document is the starting point for a human developer reading or changing the website.

## Fast orientation

This is a private single-owner HTML/CSS/JavaScript site hosted on Cloudflare Workers. There is no bundler or desktop/local-server application. `worker.js` dispatches API requests to handlers in `functions/api/`. Projects and attachments use R2; Workshop families/products/uses and Knowledge tiles/links use D1. Git commits do not back up stored application data.

### What lives where

| Area | File | Responsibility |
| --- | --- | --- |
| HTML and load order | `index.html` | Navigation and page scaffolding; includes browser scripts |
| Shared header | `assets/site-header.js` | ES module; explicit `initSiteHeader()` from each page, one branding/navigation/account structure |
| Site entrypoint | `assets/site.js` | Main navigation, learning tiles, admin/login, photo setup, controller initialization |
| Assembly and workspace | `assets/site-assembly.js` | Canonical assembly tree, workspace, BOM, part-detail and photo-storage workflows |
| Part/component editor | `assets/site-assembly.js` | BOM component editor, review/save flow and component API integration |
| Shared photo controls | `assets/photo-editor.js` | Pencil launcher and modal dialog shell reused for parts and assemblies |
| Pure BOM selector | `assets/bom-model.js` | Assembly descendants, visible purchased parts vs shop stock, quantity/assembly display labels; no browser or storage dependencies |
| Recipes / work instructions | `assets/recipe-editor.js` | Discrete instruction steps, editing, local recipe UI state |
| Workshop | `assets/family-workshop.js`, `assets/workshop-ui.js`, `functions/api/workshop-db.js` | D1 families/products/uses and related Knowledge |
| Legacy resource linking/calculators | `assets/resources.js` | Still used by workspace references and calculators; do not delete before auditing readers |
| Knowledge | `assets/knowledge.js`, `assets/knowledge-model.js`, `functions/api/knowledge.js` | Plain-text tiles, explicit links and related knowledge |
| BOM selection | `assets/library-part-picker.js` | Choosing library/Workshop parts |
| Drawings and part files | `assets/drawings.js`, `assets/part-files.js` | Drawing attachments and files |
| Shared calculation rules | `assets/engineering-core.js` | Pure domain functions, portable outside browser |
| Local project and recovery | `assets/local-project.js`, `assets/archive-check.js` | Local project support and archive validation |
| Shared styles | `assets/theme.css`, `assets/ui-kit.css`, `assets/components.css` | Tokens; site header, controls, sections and cards. Detailed contract: `UI_STANDARDS.md` |
| Legacy styles | Ordered `site*.css` files | Frozen except reviewed removals; migrate ownership rather than add patches |
| API controllers | `functions/api/*.js` | Cloudflare-backed data reads, writes, and archive endpoints |
| Source-level tests | `tests/*.test.mjs` | Behavior checks, API simulations, structural assertions |
| Data design | `docs/DATA_ARCHITECTURE.md` | Target model and backup/migration constraints; NOT a statement that all targets are implemented |

## How browser code connects

Workshop and Knowledge use ES module entry points. Every page calls the shared header module's explicit initializer. The main page still loads the existing classic feature controllers before `site.js`; their global lexical dependencies require the current order. `window.BSUI` remains the deliberate shared-kit bridge during migration. New modules must not add globals or execute application initialization implicitly at import.

The shared header reuses the existing Account button on the main page so its authentication handler survives initialization. Standalone-page Account links open the same existing account UI. No separate sign-in implementation is introduced.

## Common change paths

### Change BOM list layout or behavior
1. Start in `assets/site-assembly.js` and find `renderWorkspaceParts` or the BOM rendering code.
2. Use shared components and a feature-owned layout file; delete replaced legacy rules in the same batch. Edit `assets/theme.css` for shared values.
3. Change filtering/quantity labels in `assets/bom-model.js`, then run `tests/bom-model.test.mjs`.
4. Confirm both thumbnail and list views, nested assembly quantities, and the standard shop-materials section.
5. Do not alter quantities or persistent records for a purely visual change.

### Change part details or part editing
- Workspace part detail display: `assets/site-assembly.js`.
- Component edit/review/save controller: `assets/site-assembly.js`.
- Server writes/validation: `functions/api/components.js`; workspace data: `functions/api/workspace.js`.
- Always distinguish display-only values from saved data and generated BOM entries.

### Change work-instruction steps
- Main editable recipe UI: `assets/recipe-editor.js`.
- Workspace mounting and data loading: `assets/site-assembly.js`.
- Data structure contract: `docs/DATA_ARCHITECTURE.md`.
- Avoid bringing back obsolete blank instructions fields; steps should reveal optional fields only when needed.

### Change workshop resources
- `assets/family-workshop.js` and `functions/api/workshop-db.js` own the current Workshop.
- `assets/resources.js` still provides calculators and legacy resource links; it is not the D1 Workshop.
- Current structural changes require numbered D1 migrations, never edits to applied migrations.
- A reference link is not automatically a new BOM quantity.

### Change backups
- `functions/api/project-archive.js`, `archive-staging.js`, `automatic-backups.js` and `assets/archive-check.js`.
- Read `docs/DATA_ARCHITECTURE.md` first. **Never** treat a source-code rollback as restoring project data.
- Make no destructive data migrations as part of a UI or organization refactor.


### Photo editing and clipboard paste
- Shared editor: `assets/photo-markup.js` and `assets/photo-markup.css`. The project/assembly/part photo dialogs accept pasted images; work-instruction steps already accept image paste.
- Gallery, part thumbnails, and image work-instruction attachments all use `/api/photo-annotations` for edited rendering. `GET ?view=1` returns the edit rendition when present or the unchanged original otherwise.
- The original R2 object is **never overwritten** by markup. Separate `photo-annotations/<original-key>.json` and `photo-renders/<original-key>.webp` objects hold editable instructions and rendered output. Users can later alter or reset crop and marks. Replacing a part thumbnail clears its old edit objects.
- The editor handles crop, pen, highlight, arrow, circle, text, undo/redo/reset and explicit save. Access to write follows project edit permissions. No history migration occurs.
- Google Photos integration is not part of this implementation.

## How to run checks

From the repository root:

```sh
npm run check
```

This includes syntax checking of the site scripts and Node's test suite. A separate GitHub Actions browser regression runs Playwright with mocked project data, confirming feature-tree navigation and the BOM's distinct list rows. The tests are useful safeguards but **not proof** that every browser workflow works. After modifying UI, manually verify login/admin, project navigation, assembly expansion, BOM display, opening a part, saving part details, recipes, drawings, and project backup/download. Verify the Cloudflare deployment build status before reporting live deployment success.

## Maintenance rules

1. Keep browser feature logic separate from server data validation.
2. Record new features in this guide with an entrypoint, data ownership, and dependencies.
3. Make small, reviewable changes with tests; avoid broad string-replacement changes without checking every match.
4. Give saved entities stable IDs. Don't infer identity from a displayed name.
5. Preserve historical project records. Never silently migrate or discard storage formats.
6. Document an intentional dependency in code or this guide rather than relying on unexplained calls across files.
7. Put new pure calculations in `engineering-core.js` (or another testable pure domain module), not inline in DOM handlers.
8. New tests should assert observable behavior where practical, not only that source text contains a phrase.

## Current architecture and remaining debt

Assembly and part management now lives in `assets/site-assembly.js`, loaded after
`assets/photo-editor.js` and before `assets/site.js`. This is one canonical
controller, not two copies. Its large closure remains intact because its
callbacks share state; the Playwright browser test guards its initialization.

CSS is divided into four sequential stylesheets to retain the established
cascade, with all palette colors in `assets/theme.css`. Their order matters.
Future cleanup can consolidate overlapping selectors after visual regression.

Part photo and assembly photo editors now share pencil and modal UI controls.
Their storage adapters remain separate because their API endpoints differ.
No persistent data, photo IDs, part identities, or API formats were changed.

Remaining work: explicit dependency injection between scripts, gradual
extraction of tree/BOM/workspace logic, and browser tests for persistence,
archived revisions and restoration.

## Publishing

GitHub `main` is the source branch. Cloudflare's production deployment depends on the site's configured build/integration. Confirm its status separately. A deployment should not modify stored project records merely because code was reorganized.


## Work-instruction note and photo identity

`assets/recipe-editor.js` keeps each step's existing `notes: string[]` and
`photos: string[]` fields for compatibility with historical workspaces and
backup archives. The accompanying `noteIds: string[]` gives each note a stable
identity; `photoNoteIds: { [photoId]: noteId }` associates a photo or document
with its note independently of note ordering.

Older workspaces with `photoAfterNote: { [photoId]: noteIndex }` are migrated
non-destructively when read into the editor. The old index map remains in
saved records for backwards compatibility. Do not infer photo ownership from
array order in new code.

The backend validates note IDs, uniqueness, and referenced photo IDs on save.
Deleting a note unassigns its attachments but does not delete uploaded files.
Part and assembly workspace save handlers refuse to save while attachments
are uploading; successful saves notify the recipe editor to clear its dirty
state. Failed saves leave input and attachments in the editor for retry.

Regression coverage: `tests/recipe-note-ids.test.mjs` exercises legacy
migration, note reordering, deletion, and stale-save protection; the Playwright
startup suite covers upload/save UI behavior and photo preservation.



The private-owner cleanup removes public visibility/editing controls, proposal review, My Build/stuck feedback, administrator-password linking and unloaded tracker/component scripts. Stored project publishing flags no longer grant read access. Existing owner accounts and session cookies keep working; the administrator role can manage all retained projects. Summary disclosure state is a browser preference in summary-state.js, separate from project data. Retired feature API URLs return the normal JSON 404 for the owner; unauthenticated requests still stop at the private API boundary.


Practice records upgrade once to Notes through record-upgrades.js. Before changing the investigation store, the API writes and reads back an immutable recovery copy under record-migrations/<project>/. The conversion preserves record/entry IDs, field text, descriptors, dates, attachments and unrelated records. An R2 ETag conflict aborts instead of overwriting a concurrent edit. Recovery copies are part of project exports and restore validation. Existing drafts receive a revision conflict after an upgrade; there is no silent overwrite.


All built-in and newly created projects use project-workspace-template in index.html and the same catalog/card renderer. There are no duplicated built-in project sections. Original project IDs stay stable for routing and data storage; nested field IDs and their label/ARIA references are unique per instance. Layout selectors use project-view rather than project IDs. The strict CSS producer check follows the browser import graph and documents computed class patterns in scripts/css-dynamic-classes.json.

Part details use assets/part-information.js (an ES module dynamically imported by the assembly controller) and the shared BSUI informationPanel/fieldRow helpers. The module owns presentation and receives the existing revision-checked write callback. assets/family-model.js derives separate Workshop and project specification rows while preserving the existing combined projection for BOM/historical readers. These view fields are not persisted or migrated.

Workshop and Knowledge explicitly initialize assets/split-panes.js from their page modules. Page CSS defines responsive grid tracks and default list widths; ui-kit.css owns the divider, theme.css its shared bounds. Width preferences are localStorage presentation settings, never server data. ResizeObserver and breakpoint listeners clamp effective widths while retaining preferences across viewport changes.


## Approved project-engine replacement

The current production project engine remains R2-backed. `HISTORY_REWRITE_PLAN.md` and `BATCH0_CUSTOM_PART_SPEC.md` define the approved D1 replacement and its gates; they do not claim it is implemented. Initial scope is one project root and custom parts. Workshop integration, nested assemblies, purchasing, markup, code and harness follow later. The preview flag must never be set in production until the owner approves cutover.

The legacy `resources.js` server import still supplies reference definitions and link IDs. Its browser no longer calls the retired common-parts or purchased-parts routes, or mounts their abandoned editors. Wire/harness and calculator/reference readers remain until their planned replacement. The legacy JS size baseline prevents adding more features to frozen controllers; rebuilt modules stay below 40,000 bytes. The declarative Workshop seed is an explicit data-file exception.

The legacy functional-part model remains in `functions/api/functional-part-model.js`: a stable requirement/number and a selected physical implementation. Purpose and project tree labels remain project-owned; changing the selected physical implementation must not change the number or instructions. Number sequences reserve 1–99 for assemblies and start parts at 100. Legacy compatibility is temporary and is not a requirement to reproduce its obsolete fields in the new engine.

## Recovery and release operations

Production uses `WORKSHOP_DB` for Workshop/Knowledge and `PHOTOS` for project data/files. Branch previews must use `building-schmidt-workshop-preview` and `building-schmidt-photos-preview`. Never point QA at production. D1 migrations are append-only; retain databases and R2 bytes across code rollbacks.

Export Workshop to NDJSON and verify with `node scripts/workshop-backup.mjs <file>`. The verifier checks bytes and checksums, not just record counts. A project export must also include its linked dependencies and newer namespaces. Neither Git nor a same-bucket weekly snapshot is independent data recovery. Scheduled success, edge throttling and Cloudflare Access require separate infrastructure verification; passing local tests does not establish any of them.

Before a release, require all checks at the exact PR head and verify Cloudflare's production build after merging. Test owner login, direct anonymous denial, catalog/part reopen, files and export. If a release regresses, stop edits and verify exports before a data-affecting reversal. Roll back code to the immediately preceding authenticated healthy release; retain bindings, D1 rows and R2 files. A former UI may temporarily hide D1 uses. Never reseed/delete a database or reopen registration/paid AI to get a green deployment. The historical pre-functional-parts checkpoint `b1d628794e8944dc7eef0e726f71f98db18f36ec` on `backup-before-functional-parts-2026-11-20` is a source reference, not the recommended current security rollback and not a data backup.

Outstanding legacy risks to verify during replacement: finite embedded instruction-history windows; uneven stale-form guards; non-transactional multi-object saves/number allocation; archive coverage and concurrent export consistency; upload-versus-save format validation; login resource limits; private static serving across all hostnames. Prior dated audits described older code and test failures, not current measured production state. Use current code and tests to establish each risk before changing it.

The family Workshop owns category → family → optional product → project use. Hidden fields keep values; populated field type/unit changes are refused; zero and false are values. Project requirements remain separate from product facts. Seed data is catalog definitions only, not user products or inventory. Its former release/progress documents are superseded by this guide, the architecture and current tests.

## Owner AI part lookup

The owner requested restoring the existing owner-only lookup under their reported enforced $5 provider cap. `AI_LOOKUP.md` describes the `AI_LOOKUP_ENABLED` switch, conditional daily attempt reservation and safe provider-limit errors. This is a separate API/configuration change, not part of the new project engine or Workshop-family redesign. It neither changes billing nor enables the unrelated extraction route. A successful real-provider check is required before claiming the deployed lookup works.
