# Building Schmidt — Codebase Guide

This document is the starting point for a human developer reading or changing the website.

Read `STATUS.md` for current releases, the next integration step and open verification gates. This guide owns the code map; the History plan owns behavior/acceptance, and the feature inventory owns retention decisions. Keep release state in `STATUS.md`, rather than adding dated status documents.

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
| Project item creation | `assets/part-create.js` | Project-only parts, documents and code; Workshop family/product selection stays on Workshop |
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
- Helpful tools accepts new Tool/Calculator references only. Saved `resources.parts` remains readable/removable through the legacy catalog until cutover; no migration is performed by hiding its creation option. Engine tools use D1 Workshop identities and last-known names (planned, not this picker change).
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

The first new-engine foundation is isolated in `project-command.js`, `project-engine-migrations.js`, `project-engine-proof.js` and `project-engine.js`. The real Cloudflare proof passed; the custom-part preview API now also uses its guarded commands. See `PROJECT_ENGINE_FOUNDATION.md` for the exact admission SQL contract, live D1 gate and rollback. The normal production project screens still use the legacy engine. The production flag is absent; importing these modules alone does not migrate or write storage.

`assets/project-item-model.js` owns the new custom-detail/build-field validation, automatic-number formatting and revision comparison rules. The custom-part preview API shares these rules. See `PROJECT_CUSTOM_FLOW.md` for its data, files, restore, acceptance status and rollback. It adds no production write path.

An isolated preview with an empty account store is provisioned through the one-time operator procedure in `PREVIEW_OWNER_SETUP.md`. Its `scripts/preview-owner-setup.html` runs as a saved browser file, generates canonical hashed account JSON, and is excluded from deployed assets. The owner uploads the two generated files only to the preview bucket. It adds no signup route, production bootstrap, authentication bypass or runtime dependency.

## Owner AI part lookup

The owner requested restoring the existing owner-only lookup under their reported enforced $5 provider cap. `AI_LOOKUP.md` describes the `AI_LOOKUP_ENABLED` switch, conditional daily attempt reservation and safe provider-limit errors. This is a separate API/configuration change, not part of the new project engine or Workshop-family redesign. It neither changes billing nor enables the unrelated extraction route. A successful real-provider check is required before claiming the deployed lookup works.

## Work Instruction first-entry visibility

The shared section action row sits directly in the active-entry host, before its content. The empty-state check must inspect that host, not only the content subtree; otherwise an empty Work Instruction hides its Add entry button even in Edit mode. Cancelling the first new-entry form must also leave the action row available. The small visibility fix changes no record format, save API, permission or stored instruction data. Browser regression covers first-entry creation/cancel and saving/reopening Notes, Tests/Measurements, Revisions, Failures and named Photos at desktop and phone widths using the actual Worker handlers.
# Copy a project product to Workshop

Project-only off-the-shelf parts expose **Copy to Workshop** inside Part details → Part information. `project-product-copy.js` reads the owner-authorized components API, asks for an active family, and opens the existing product editor with a new UUID. Nothing is written before **Save product**. Manufacturer, MPN and supplier offers are copied; reusable specification text is retained in Notes for manual review against the family's typed fields. Units and field meanings are never guessed. An active matching family/MPN/manufacturer offers the existing product before deliberately creating another copy. Failed saves retain the editor draft.

Project purpose, number, quantity, annotations, photos/files, instructions, history and source IDs stay with the source. Copying does not link the source to the new product or mutate it. In-house parts, documents, generated materials and already linked Workshop uses do not offer this action. All writes retain the existing owner, origin and family-revision checks and Workshop backup coverage. No new schema, endpoint or dependencies. Revert the UI/module changes together to roll back; already saved products remain normal Workshop products.
# Work Instruction save protection

`work-instruction-save-guard.js` is explicitly installed by each recipe editor. The guard includes new instruction drafts, which intentionally are not yet in the workspace save payload. Navigating out of a draft opens its Work Instructions section, identifies its name and focuses its editor; Save/Cancel remain available. The draft is not silently saved or discarded. Existing dirty saved steps retain save-before-navigation, and failures cancel navigation. Genuine drafts, edits and in-flight saves still trigger the browser's native leave warning; the page identifies the instruction because browser warning text itself cannot be customized. A clean editor, completed save or cancelled edit does not trigger this guard. Photo saves are independent.

The former inline navigation/unload handlers were removed from the frozen recipe controller, which shrinks. No storage/API changes. Regression workflows cover clean state, collapsed draft navigation, cancellation, failed/successful saves and edited existing steps at desktop/phone widths. Rollback by reverting the guard and controller together; stored instructions remain unchanged.

# Project directory views

`project-directory.js` owns project cards, search/sort projection, the View control and summary-photo thumbnails. It is explicitly initialized by the existing project manager; no new global or server data is introduced. Details, List and Tiles share one renderer, shared tokens/controls and one small layout stylesheet. Tiles is the former Large icons layout; the former horizontal Tiles layout is removed. Saved `icons` preferences map to `tiles`. `directory-filters.js` supplies descriptor controls for both Projects and Calculators. `calculator-directory.js` reuses the directory renderer with its own view preference, topic filters, unit/purpose/name search and alphabetical sorting. It opens one calculator form at a time and retains inputs when returning to the results during the page session. View preference persists in browser storage, with safe defaults if storage is unavailable. Sort and descriptor/search filters apply in every view. Details labels the existing timestamp **Created**; it does not invent a modification timestamp.

Thumbnails use the same `assembly=project-summary` album and first-photo order as the summary page, including eligible legacy unassigned photos while excluding root-assembly and instruction photos. The project controller emits `projectphotoschanged` after summary refresh/upload/delete; the directory invalidates its per-project photo cache. Missing or failed photos retain an initial. No duplicate photo field is stored in the catalog.

Replaced card/render code is removed from the frozen project manager; obsolete card classes/rules are pruned from all three legacy stylesheets and added to the curated retirement guard. The frozen CSS hashes change only for these deletions. Cards remain native keyboard buttons with the same project routes. Rollback by reverting HTML, modules, CSS and updated retired-class guards together; preferences/data need no migration.

# Project files and grouped downloads

Parts Management includes a standard, initially collapsed **Project files** section. `project-files.js` is explicitly initialized from the project controller. The owner can search by filename/part, filter STL, SOLIDWORKS, PDF drawings, STEP or other formats, select visible files across filters, and download one ZIP. Files are grouped by part number/name with unique filename prefixes, so repeated names across ten parts are retained. Individual download and owner-page links remain available.

The read-only `/api/project-files` index scans paginated `part-files/<project>/` and `drawings/<project>/` objects and includes only current project parts/assemblies and the selected physical implementation. Existing unversioned file owners and Workshop project uses are included. Removed parts, inactive implementations, unrelated projects, source Workshop attachments and instruction attachments are excluded; those retain their own interfaces/history. No data or schema is created or migrated. Existing project backup coverage is unchanged.

The API requires owner/project authorization, checks an exact current-owner prefix and validates the listed R2 ETag before returning bytes. Replaced files return 409; removed/no-longer-current files cannot be fetched from an old selection. Browser-side `project-files-zip.js` streams uncompressed ZIP entries into a bounded download blob, with UTF-8 names, CRC32 and standard central directory. ZIP creation runs in the browser, not on Cloudflare. Groups are limited to 100 files / 200 MB; choose smaller groups on constrained devices. A failed or changed file aborts ZIP creation rather than quietly producing a partial collection.

This collects a print job; it does not operate a printer, slice meshes, open SOLIDWORKS or merge PDF pages. Open the downloaded files together in the appropriate application. The browser never receives a Dropbox credential or new cloud permission. No new dependency is introduced. Tests cover actual Worker authorization, pagination, active selection, stale-file denial, standard ZIP metadata/CRC and ten STL plus ten drawing files across desktop/phone workflows. Revert the API/module/UI batch to roll back; all original file bytes remain in storage.

# Part creation, purchasing fields and specification editing

`part-create.js` owns project-only Part/Document/Code creation as an ES module. The project controller explicitly imports its creation function; the old classic picker, script tag and global are removed. Changing to Custom — made in-house hides Manufacturer and MPN immediately; switching back preserves the unsaved form values. Neither is required for an in-house part. The editor also hides its whole Where to buy section for in-house parts/documents, without deleting file/history data or introducing a purchasing stage.

`part-specifications.js` builds one standard, initially collapsed Specifications section around the existing inputs and handlers. Add specification stays inside that section, with shared button sizing and keyed explanatory help in `part-help.js`. The supplier add action uses the same kit/action row. Replaced legacy specification shell/button CSS is deleted at its source. One shared row builder serves saved, manual and AI-created specifications; controls stack at the standard phone breakpoint without overlapping. The original part-label selector specificity is reduced so its existing phone layout can take effect. Existing AI suggestions still open the same disclosure through its retained controller hook; fields and values are moved, never cloned.

The separate inline Edit purpose form is removed. Purpose remains visible in Project information and editable through the existing Edit part details dialog, alongside the rest of the part. Alternatives retain their revision-checked selection/add workflow. Browser tests verify purpose save/failure draft retention, unchanged project annotations, optional in-house sourcing fields, shared control geometry and specification save/reopen on desktop and phone. No schema/API changes. Revert this UI/module/CSS batch together to roll back; all stored part data remains intact.


# Part revisions and parent-scoped archives

`part-revisions.js` owns the Revisions section at the part-page bottom. Create a Revision opens `history-entry-dialog.js` with optional What changed, Why did you change it, Notes and photos. The uploader is the shared choose/paste/drop surface, with thumbnails, names and removal. Save revision copies the saved engineering state plus metadata; it does not open the part-details editor. The working part advances once, from Revision 1 to 2 on its first numbered revision. Each saved copy appears once as a chevron disclosure with revision label, date and What changed; full saved details expand in that same section. Working revision appears as group metadata and the count includes saved copies only. Existing unnumbered copies stay Earlier copy. The current level is also visible in project information. `data-table.js` remains the shared semantic-table helper and is now used by Workshop family fields; it is no longer used for the removed duplicate revision index. `dialog-form.js` is the shared custom-body form shell: busy/cancel/focus behavior stays there. Drafts and uploaded IDs survive failed saves; dirty prompts warn on leaving, while Save/Cancel clears the warning. One prompt per trigger and disabled in-flight submits prevent duplicates. Identical revision retries retain their operation ID; changing text/photos creates a new command. `history-entry-details.js` normalizes the bounded metadata on the server (5,000 characters per field, 12 named project-owned images, 120-character photo names). Edited operation reuse and cross-project photo IDs are refused.

`part-revision-snapshot.js` freezes the saved part, workspace, source records and local file bytes under part-revisions. Explanations/photos live once in the snapshot’s entryDetails. Current part/instruction tokens and conditional part writes guard capture; create-only copies are read back and hash checked. Limits remain 300 project records, 250 KB initial metadata / 500 KB with file list, 20 MB per file / 100 MB total, and 500 copies. Failed captures can retain unlinked private copies. Downloads are owner/project scoped. External URLs remain references. Older snapshots stay readable and explicitly identify missing historical file-byte isolation. Exports and isolated recovery staging retain the new metadata/bytes.

`part-revision-editor.js` supplies Save as revision in the existing part-details editor, using the same explanation/photo prompt. It captures the previous saved state before saving the edits. Standard Save retains the working level and creates no history; both have keyed tooltips. Revision saves use explicit source tokens and retain the draft on conflicts instead of automatically merging a different source into the historical copy. `part-editor-attachments.js` keeps the existing post-save product-page/photo attachments and independent warnings outside the frozen controller. `component-values.js` owns the unchanged price/quantity validation extracted from the frozen component controller.

`part-revision-save.js` stages and verifies the immutable record.json and file copies before any working edit. The custom part's revisionLevel, revisionHistory reference and edited fields commit in one conditional R2 component-object write. Workshop-backed Create a Revision commits the counter and reference together in that project use's existing D1 project_state (a guarded use-row update that also checks the captured family/product revisions), leaving reusable family/product facts untouched. No schema migration or new project engine is introduced. `part-revision-records.js` combines referenced records with existing investigations records for reading; it does not migrate or renumber old copies. An operation fingerprint retained on the owning part prevents duplicate advancement on lost-response retries, including after the historical copy was deleted. Deleted references retain their operation receipt and never roll back the counter. Deleting referenced history updates its owning part with a conditional write. Refused or failed saves can leave private, unreferenced staged bytes; these are never shown as successful history. Tree archives freeze referenced records and their bytes and restore the references; exports and isolated recovery include the whole namespace.

After numbered history is written, retain the compatible reference reader and writer when rolling back presentation changes. Older-only handlers do not read referenced copies and must not overwrite revisionHistory or revisionLevel. Preserve immutable records, references and bytes; no data deletion or reseeding is part of this change.

`tree-archive.js` replaces the legacy archive controller previously inside site-assembly. The tree context menu exposes Archive part / Archive subassembly, with an optional reason, Notes and the same photo controls. The competing Delete menu entry and individual-record Archive UI are removed. Existing record archives remain readable; no data migration deletes them. After removal, navigate to the original parent and expand History → Archive. Archive count contributes to History’s count. Read-only viewers show original location, explanation/photos, children, saved files and readable saved part/instruction/record details. Restore to build uses guarded server restore. Add to Project Milestones remains an explicit draft action inside the saved archive; it never creates a milestone automatically. No permanent-delete control is added to this flow.

The archive API keeps custom definitions and Workshop uses distinct. Raw custom definitions stay in parts; frozen Workshop projections stay in workshopParts, and guarded D1 row/source revisions stay in workshopUses (schemaVersion 2 for removals containing Workshop uses). Reusable families/products are never archived or rewritten by this action. A single D1 statement changes every affected project-use flag or none. Other placements remain active. Archive copying includes existing immutable revision namespaces, so deleted/replaced original drawings do not invalidate an already frozen revision. Earlier archived children remain separately discoverable under their original parent. Number registers and stable IDs are retained. Before removing membership, reserveProjectNumbers backfills every existing part/subassembly number into the permanent register. number-reservations.js also checks older archive manifests during allocation/lookup and persists those historical reservations on successful allocation. Assigned numbers, padding aliases and sequence reservations cannot be reused after archive, restore or later archive-copy removal. Archive retries use an indexed operation receipt with committed-manifest recovery; edited operation reuse is refused.

This remains the legacy R2 engine. D1 flags, R2 tree and component membership are not one cross-storage transaction: expected versions, verified staging copies, conditional writes and guarded compensation protect the supported failure paths. A conflicting tree restores flags; a failed restore re-archives flags and advances the manifest’s guard revisions for retry. Reusable source changes or missing historical bytes stop restoration for review. A compensation failure reports retained recovery data and a reconciliation requirement. This is not the atomic D1 project engine; the later rebuild must replace this boundary. Tests exercise real SQLite/Worker handlers and disposable R2, not a fresh Cloudflare D1 gate.

Roll back the presentation separately if needed. After Workshop archive writes, retain the compatible archive/recovery handler and all manifests, D1 uses and R2 bytes; an old-only restore handler cannot restore the new Workshop flag lifecycle. Custom source records, reusable Workshop facts, accounts and Knowledge remain intact. Do not drop/reseed storage to roll back UI changes.

Old archive form/viewer ownership and replaced CSS are removed at source; frozen stylesheet hashes change only for reviewed removals. The feature inventory remains unchecked for the D1 rebuild. PRs 52/53 and the production new-engine flag stay unchanged; none of this accepts or deploys that preview cutover.

Legacy part-photo requests: `functions/api/component-photos.js` discovers existing current/unversioned thumbnail keys with a paginated R2 metadata listing. The strict index rejects incomplete listings, but the components reader degrades listing/head failures to unknown availability so all parts remain readable. Inherited-image existence uses R2 `head`, never an unread image body. Custom/document parts with a confirmed own photo or suppressed fallback skip the Workshop lookup; purchased sourcing remains available. The components reader returns `hasPhoto`; `assets/part-picture.js` owns race-safe loading and skips a request when absence is confirmed. Older saved photos and permitted Workshop fallbacks remain visible. No photo marker is written into engineering data.

# Shared page presentation

`ui-page` in `ui-kit.css` owns one full-width horizontal gutter for the header, titles and task columns. Workshop/Knowledge no longer center separate capped grids; legacy catalog gutter overrides were deleted at source. Shared section/panel action variables select 32px buttons, while page toolbars retain 44px controls. `workshop-ui.js` turns keyed panel guidance from `interface-help.js` into the existing `dialog-system.js` tooltip. The standalone pages load its shared stylesheet; no second tooltip or new dependency is added. Errors/status/conflicts stay visible, saved engineering text is retained, and empty detail panels stay blank. The main page uses plain Building Schmidt branding.

`UI_STANDARDS.md` records the current owner handoff, its engine-only backlog and the newer separate-Revisions decision. Do not apply stale source line numbers or repeat PR #67/#68 changes, erase legacy project tags early, or truncate existing part names/history during the planned identity migration.

`field-disclosure.js` builds a standard label/value row with an inline native disclosure. The current Alternatives control uses it instead of a nested section, labels the selector Select Alternative and accurately calls the existing add-and-select command Add and select alternative. It changes presentation only; per-alternative notes/files and guarded comparison are explicitly planned engine work in `HISTORY_REWRITE_PLAN.md`.

Record cards now use the shared section/header for active and archived entries, retaining their IDs, lifecycle, body renderer and expansion state. Archive deletion stays inside the expanded body as a small danger action. Replaced header rules were deleted from the frozen stylesheet and added to the curated retirement guard. Engineering-file labels/revisions remain a separately planned feature, independent of part revisions, in `HISTORY_REWRITE_PLAN.md`.

### Engine versus legacy file APIs

functions/api/project-files.js remains the live legacy project-wide files/download owner used by worker.js. The gated engine uses functions/api/project-engine-files.js for immutable prepare/upload/admit/download, imported only by project-workspace-api.js and project-backup.js. This explicit name avoids two unrelated handlers sharing a module path; the engine file was moved without changing its implementation. The browser legacy assets/project-files.js is also retained. Do not merge the two ownership models or retire either reader before its replacement and recovery coverage exist.

### Engine evidence edit history

The gated workspace editRecord command updates current evidence and inserts its immutable record_edited event in one guarded batch. The payload retains before/after text/type/title/date/attachment IDs, actor, original design/context, step capture and creation-event link. Its edited_record_id intentionally differs from record_id, preserving the unique record-to-creation-event mapping used by record/Knowledge navigation. Event-owned file links retain both attachment sets. project-history.js filters/searches saved audit values under Changes; project-history-view.js renders fixed Before edit/After edit panels without editing controls. Export/restore includes the events and file links through the explicit existing schema. No new migration or production path is introduced.

### Engine recovery as a copy

The normal project backup picker requires a new project name and calls the gated import-copy route with a fresh project UUID. Failed requests retain the file/name and target/operation IDs for exact retry. project-backup.js coordinates byte verification and atomic visibility with original-identity import; only the new project header and relational project_id scope change. Child IDs and immutable captured JSON/fingerprints remain exact. R2 staging keys include target project and operation, keeping recovered copies independent. The receipt distinguishes sourceProjectId from projectId. No existing source is overwritten, and original-identity import remains the operator proof path.

`project-backup-schema.js` owns explicit engineering columns, legacy defaults and a thin validation outline. `project-backup-stream.js` owns byte-bounded keyset reads, reference/file validation and source-revision checking before the final export marker. `project-restore-staging.js` owns private staging, its sealed fingerprint, hidden project creation and bounded actual-row materialization. Migration 6 adds operational restore jobs/rows plus the project marker; these are excluded from engineering backups. `project-command.js` verifies each loaded column/count against sealed staging before its three-statement publication/receipt transaction. Normal ownership, listing, Workshop reverse-use and command admission all exclude pending projects. Exact retries resume only the same actor/operation/fingerprint; failed/mismatched copies stay hidden. Retain these readers if rolling back presentation; older marker-unaware readers are unsafe. Cleanup of abandoned jobs/copies is still deferred, with no deletion performed by this importer.

### Engine numbered revisions and saved evidence

`project-snapshot-values.js` owns project-scoped content-deduplicated frozen values and format-5 checkpoint resolution/backup validation. `captureProjectPart` returns a snapshot plus a guarded write plan; the caller admits both with its revision/archive/product-change event. Mutable records, instructions and link states are frozen once per distinct value, and immutable audit/configuration/file/source values are shared by checkpoints. History expansion verifies hashes and fails on missing references without consulting current text. Old inline snapshots pass through unchanged. `project-backup-metadata.js` keeps small version-1 manifests and streams larger version-2 metadata as bounded NDJSON rows before files. Migration 5 and every new value type are included in complete recovery.

project-part-snapshot.js owns bounded full-part captures and named explanation/photo validation; migration 3 adds the working revision counter. project-part-history.js owns the shared prompt, retry/review and single-copy disclosures with guarded pagination. project-information.js is the shared information/configuration/context/record renderer for working History and full saved copies. Snapshot format 3 includes record creation/edit events and file links without recursively copying previous full revision events. The tested design fingerprint remains independent of the working counter.

context-menu.js supplies the transient keyboard/touch/right-click menu reused by the engine tree. history-entry-dialog.js accepts the engine upload callback while its legacy default stays unchanged. The named gallery's five base rule blocks move from site-polish.css to history-photos.css at identical values; index.html and project.html load that shared owner. Existing upload-panel styles remain in photo-markup.css. BSUI supplies the reused upload buttons; no alternate uploader or dialog shell is added. Independent SolidWorks/STL file revision labels remain deferred.

project-record-context.js owns the shared read-only historical context projection. The server captures an available tested level in record_context.part; API, current History and full-copy readers use the same known-level legacy rule. No level is fabricated when an earlier snapshot lacks one.

The project-history-alignment branch synchronizes the current production code into the earlier custom-part preview and applies the owner’s numbered revisions, Save / Save as revision, named-photo explanation prompt and tree Archive flow. The preview’s immutable file module is now project-engine-files.js, avoiding the independently shipped legacy project-files.js index. The production NEW_PROJECT_ENGINE flag remains absent. See PROJECT_CUSTOM_FLOW.md for migration 3, full immutable snapshots, guarded counter/event admission, number reservation, recovery limits and the repeatable source/independent-target proof. The proof page uses normal owner APIs and synthetic data only. Prior Cloudflare reports apply to their pinned source; current refinement acceptance must record fresh exact builds and bindings. No new-engine production cutover, nested-assembly claim or data deletion is implied.


### Nested project and Workshop preview

`project-tree-model.js` owns pure hierarchy/quantity rules; `project-placements.js` owns guarded placement and archive-group commands. `project-workshop.js` freezes server-resolved source facts and copies immutable catalogue files into project ownership; `project-selection-uses.js` is the owner-filtered reverse reader. These do not dual-write legacy Workshop uses. The UI separates tree/context actions (`project-tree-view.js`), BOM (`project-bom-view.js`), source selection (`project-workshop-editor.js`) and the shared detail/history editors. `project-assembly-proof.js` exercises the normal owner API path from the gated proof page. Migration 4 and backward-compatible backup handling are described in `PROJECT_ASSEMBLIES_WORKSHOP.md`. Production remains flag-disabled.

Preview operations: `scripts/preview-acceptance.mjs` invokes the same browser proof functions with an injected HTTP transport, checks runtime version bindings through the Cloudflare read API, and uses ordinary owner authentication. `docs/PREVIEW_ACCEPTANCE.md` owns this runbook; exact immutable evidence is under `docs/proofs/`.
