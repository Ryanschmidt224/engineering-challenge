# BuildingSchmidt feature inventory (main page)

Status: owner decisions recorded 2026-11-22 (baseline from `main` at `f73e021`). Lines with a blank Decision are **Keep**.

## Owner decisions (2026-11-22)

- **Drop:** 1.4 admin-password link · 3.2 Public/Unlisted visibility (all projects private) · 3.3 Allow suggestions · 7.10 suggestion review queue · 11.3 My Build and stuck/confused feedback · all of section 11 (leftovers).
- **Change:** 7.4 remove the Practice (legacy) record type and convert existing Practice records to Notes · 5.13 rebuild the harness cutting list on Workshop wire products and delete the separate wire library · 6.8 keep AI spec lookup but redesign it around the Workshop; the owner subsequently requested restoring part lookup under their reported enforced $5 provider cap (see `AI_LOOKUP.md`).
- **Keep:** 5.12 DigiKey cart.
- **Project summary sections:** remember each section's last open/closed state (per browser); first visit uses collapsed.
- **Dead-CSS check:** strict. A change fails if CSS names a class no page or script produces, except classes on an explicit allowlist of code-built patterns (for example `part-progress-*`) and the curated retired list.
- Section 11 items are each verified against the code before deletion (no remaining caller, route or data reader).

**Purpose:** a checklist of everything the legacy main page (`index.html`) does today, so the area-by-area rebuild doesn't silently drop anything, and so the owner can decide what *not* to rebuild. Workshop (`workshop.html`) and Knowledge (`knowledge.html`) are already on the new system; they are listed briefly at the end.

**How to use it:**
- Owner: mark each line **Keep**, **Drop** or **Change** in the Decision column (blank means Keep). Lines marked *Suggest: drop* or *Suggest: decide* are my recommendations; the owner decides.
- Rebuild PRs: tick **Rebuilt** when the new version is live and checked. An area is finished when every Keep line is ticked and the legacy code is deleted.
- Code references show where the behaviour lives today, to check the rebuild against.

Legend: `SA` = `assets/site-assembly.js`.

---

## 1. Site shell, sign-in and navigation

| # | Feature | Code today | Decision | Rebuilt |
|---|---|---|---|---|
| 1.1 | Top navigation: Projects · Knowledge · The Workshop · Calculators link · Account | `site-header.js`, `index.html`, `site.js` `navigate()` | | ☐ |
| 1.2 | Owner sign-in dialog (email + password, 12–256 chars, error messages for wrong password, closed registration, service unavailable) | `project-manager.js` | | ☐ |
| 1.3 | Sign out | `project-manager.js` | | ☐ |
| 1.4 | "Link administrator access" with existing admin password | `project-manager.js` | **Drop** | ☐ |
| 1.5 | Hash routing: `#home`, `#projects`, `#<project>/workspace/<node>`, `#<project>/part/<id>`; old `#knowledge`/`#community` redirect to `knowledge.html` | `site.js`, `SA` | | ☐ |
| 1.6 | Session-expired handling ("Log in again") | `site.js` | | ☐ |
| 1.7 | Edit-conflict dialog: "Review newer changes" shows saved vs. your draft, Keep editing / Save reviewed changes | `edit-conflicts.js` | | ☐ |
| 1.8 | Transient status messages (Saving… / Saved / failed) | `transient-status.js` | | ☐ |
| 1.9 | Shared confirm dialog ("Confirm action") and example popups (double-click help, value symbols / Windows Alt codes) | `dialog-system.js` | | ☐ |
| 1.10 | Section tooltips / "?" help tips | `dialog-system.js` | | ☐ |

## 2. Project list (home)

| # | Feature | Code today | Decision | Rebuilt |
|---|---|---|---|---|
| 2.1 | Project cards with photo, name, descriptors (first 3 + "+N"), visibility label | `project-manager.js`, `SA` `createUnifiedTile` | | ☐ |
| 2.2 | + New project (name, private by default) | `project-manager.js` | | ☐ |
| 2.3 | Search projects | `project-manager.js` | | ☐ |
| 2.4 | Sort: Name A–Z / Z–A, Newest, Oldest | `project-manager.js` | | ☐ |
| 2.5 | Filters by discipline tags (Mechanical, Electronics, Software, Controls, Woodworking, PCB Design, Machining, Robotics, Measurement, Fabrication) | `project-manager.js` | **Drop in new engine**; existing legacy tags remain until cutover. Calculator topics are separate. | ☐ |
| 2.6 | Descriptor tiles: search, select, clear, add custom tags (comma separated) | `project-manager.js` | **Drop in new engine**; existing legacy tags remain until cutover. Calculator topics are separate. | ☐ |
| 2.7 | Archived projects list (under More) | `project-manager.js` | | ☐ |
| 2.8 | Empty / loading / error states ("No projects yet", "Projects could not load") | `project-manager.js` | | ☐ |
| 2.9 | Explorer-style View choices: Details, List, Tiles; persistent browser preference; thumbnail from summary album | `project-directory.js`, `project-directory.css` | **Keep**: owner requested; same sorting/filtering in every view | ☐ |

## 3. Project settings

| # | Feature | Code today | Decision | Rebuilt |
|---|---|---|---|---|
| 3.1 | Rename project (≤100 chars) | `project-manager.js`, `SA` | | ☐ |
| 3.2 | Visibility: Private / Unlisted / Public | `project-manager.js` | **Drop**: all projects private; remove the setting and the labels | ☐ |
| 3.3 | Editing permissions: Locked / Allow suggestions with owner approval | `project-manager.js` | **Drop** | ☐ |
| 3.4 | Delete project (type exact name to confirm) | `project-manager.js` | | ☐ |
| 3.5 | Part numbering format: prefix (default NR, ≤10 chars), minimum digits, next assembly preview; existing numbers unchanged | `project-manager.js`, `/api/numbering` | | ☐ |
| 3.6 | Suggested part nomenclature guidance text | `project-manager.js` | | ☐ |

## 4. Project summary page

| # | Feature | Code today | Decision | Rebuilt |
|---|---|---|---|---|
| 4.1 | Project photos gallery: previous/next, add, delete, caption, markup | `SA` `makeAssemblyPhotoStage`, gallery functions | | ☐ |
| 4.2 | Project description ("Describe your project"), save/cancel | `SA` `renderSummaryOverview` | | ☐ |
| 4.3 | Project BOM overview and Tools needed list | `SA` `refreshProjectSummary` | | ☐ |
| 4.4 | Estimated project cost: build quantity, individual vs. bulk part cost, package prices; warnings when prices are missing | `SA` `renderEstimatedCost` | | ☐ |
| 4.5 | Project Intent & Milestones: record original intent (goal, success, initial plan); add milestones (what happened, why significant), link to source record | `project-milestones.js`, `/api/project-milestones` | | ☐ |
| 4.6 | "Add to Project Milestones" from a record or archived item | `investigations.js`, `SA` | | ☐ |
| 4.7 | Unstructured Notes on the project | `unstructured-notes.js` | | ☐ |

## 5. Assembly page and feature tree

| # | Feature | Code today | Decision | Rebuilt |
|---|---|---|---|---|
| 5.1 | Feature tree sidebar: assemblies and parts, expand/collapse | `SA` `setupAssemblyTrees`, `render` | | ☐ |
| 5.2 | Resize feature tree width (drag; arrow/Home/End keys) | `SA` | | ☐ |
| 5.3 | Show/hide in tree: Workshop items, documents, selected components, hidden parts | `SA` | | ☐ |
| 5.4 | "Needs attention" marker in the tree | `SA` | | ☐ |
| 5.5 | + Part (inside the selected assembly only) | `SA` | | ☐ |
| 5.6 | New assembly: number (NR####) + name | `SA` | | ☐ |
| 5.7 | Rename, move (reparent, "Move subassembly", choose by number), reorder by drag | `SA` `moveSelected`, `reparent`, `moveToChoice` | | ☐ |
| 5.8 | Right-click Archive part/subassembly removes the selected subtree from the build and keeps the complete saved record in its parent’s History → Archive; guarded Restore to build | `tree-archive.js`, `/api/assembly-archive`, `workshop-tree-archive.js` | **Keep**: includes custom parts and Workshop project uses; no new part revision; numbers stay permanently consumed, including legacy reservations; replaces competing tree Delete | ☐ |
| 5.9 | Assembly photos (same gallery controls as 4.1) | `SA` | | ☐ |
| 5.10 | Assembly status: Not started / In progress / Complete, with "What needs attention?" note (minimize/expand) | `SA` `saveAssemblyStatus`, `installAttentionExpander` | | ☐ |
| 5.11 | Bill of materials for the assembly: list view and picture view; grouped parts; nested assembly quantities; standard shop materials section | `SA` `renderWorkspaceParts`, `bom-model.js` | | ☐ |
| 5.12 | Purchase parts: select items, "Add selected to DigiKey cart" (1–400 items) | `bom-purchasing.js` | **Keep** | ☐ |
| 5.13 | Wire harness cutting list | `SA` `showHarnessPreview`, `/api/wires`, `/api/harness` | **Change**: rebuild on Workshop wire products; delete the separate wire library | ☐ |
| 5.14 | Parts Management: compact read-only number/name/value/quantity/status list with Browse left; full read-only columns hide Browse; explicit Edit enables inputs; search/status/over-limit-name filters, reserved-number lookup and persistent view preference | `parts-management.js`; new engine BOM area pending | **Change**: no separate tree-name column; preserve remaining fields and resizable columns | ☐ |
| 5.15 | Project files in Parts Management: CAD/drawings across current parts and assemblies; filename/part search, type filters, multi-select, one ZIP for slicer/PDF printing | `project-files.js`, `/api/project-files` | **Keep**: owner requested; current project attachments, not Workshop source or instruction attachments | ☐ |

## 6. Part page

| # | Feature | Code today | Decision | Rebuilt |
|---|---|---|---|---|
| 6.1 | Part header: picture, name, Workshop family, status, needs-attention, quantity | `SA` `showPartWorkspace` | | ☐ |
| 6.2 | Part picture: add/replace (JPG/PNG/WebP <3 MB), crop/annotate, delete; fallback when missing | `SA` part picture functions | | ☐ |
| 6.3 | Part details: fields summary, View in Workshop, Documentation, Modify part, Reload Workshop data | `SA` | | ☐ |
| 6.4 | Functional role: purpose/requirements and project-owned alternative specs, notes and files; standard Alternatives row; separate Add alternative and guarded Select confirmation in the engine | `part-information.js`, legacy selection controller; new engine selection relation pending | **Change**: alternative data isolation, instruction review flag, frozen evidence and round-trip recovery per `HISTORY_REWRITE_PLAN.md` | ☐ |
| 6.5 | Specifications (from product listing or estimated), project-specific information | `SA`, `part-fields.js` | | ☐ |
| 6.6 | Part editor: item type (Part/Document/Code), part type (off-the-shelf / custom in-house / custom purchased), number (auto or user, next available lookup), name (one adjustable 20-character engine limit; no separate tree-name field), schematic/KiCad info, manufacturer, MPN, description, quantity, "Is a tool?" | `SA` `editBomPart`, `saveBomDraft`, `part-create.js` | | ☐ |
| 6.7 | Where to buy: up to 10 suppliers (DigiKey, Mouser, McMaster, Newark, Arrow, Amazon ASIN, custom), order code, URL | `part-suppliers.js` | | ☐ |
| 6.8 | Find part specs with AI: lookup by MPN/name, review suggested specs, apply selected | `product-lookup.js` | **Change**: keep, but redesign around the Workshop (category → family → product); owner requested the separate lookup-resume fix under their $5 provider cap | ☐ |
| 6.9 | Part files: CAD / Parasolid / STL / STEP upload and download (≤20 MB); saved product webpages; later independent file revision labels and exact version links | `part-files.js`, `/api/part-files` | | ☐ |
| 6.10 | Drawings (PDF): drop/upload, view, download, replace, delete (first 100) | `drawings.js`, `/api/drawings` | | ☐ |
| 6.11 | Source code on a part: language, edit, import file, save, previous versions, view/restore, download (≤100 KB) | `part-code.js`, `/api/part-code` | | ☐ |
| 6.12 | Knowledge tiles linked to this part (and family/product/use) with "New knowledge tile for this part" | `SA` `renderPartKnowledge` | | ☐ |
| 6.13 | Helpful tools: Calculator and Tool references only; engine tools use D1 Workshop IDs and last-known names, not the static catalog | `SA`, `resources.js`; engine relation/picker pending | **Change** (owner item #17): no new Workshop-part references. Legacy links remain visible/removable; engine links stay outside BOM quantities/cost/purchasing/tree and round-trip through backup. Archived sources remain readable. | ☐ |
| 6.14 | Part progress / status save | `SA` `savePartProgress` | | ☐ |
| 6.15 | Copy a project-only off-the-shelf part to a reviewed Workshop product draft; choose a family, check duplicate MPN, preserve project source | `part-information.js`, `project-product-copy.js`, existing `/api/workshop` | **Keep**: owner requested; no automatic relinking or source modification | ☐ |

## 7. Work instructions and records

| # | Feature | Code today | Decision | Rebuilt |
|---|---|---|---|---|
| 7.1 | Work Instructions list per assembly/part: add, name, rename, delete, reorder by drag, resizable list | `recipe-editor.js` | | ☐ |
| 7.2 | Autosave with "Unsaved step changes" / "More edits to save" states | `recipe-editor.js` | | ☐ |
| 7.3 | Archive a Work Instruction with optional reason; archived steps list; restore | `recipe-editor.js` | | ☐ |
| 7.4 | Records ("+ Add entry") inside a step. Types: Failures, Tests/Measurements, Revisions, Notes, Photos, Practice (legacy). Each type has its own prompts, e.g. "What happened? / What caused it? / Did you fix it?" | `investigations.js`, `entry-editor.js` | **Change**: drop the Practice (legacy) type; convert any existing Practice records to Notes | ☐ |
| 7.5 | Record attachments: up to 12 photos/files per field, ≤20 MB each, named photos | `investigations.js`, `attachment-types.js` | | ☐ |
| 7.6 | Nested entries; drag or Alt+Up/Down to reorder record tiles | `investigations.js` | | ☐ |
| 7.7 | Read earlier archived entries; archive whole parts/subassemblies through the feature tree instead of individual record controls | `investigations.js`, `tree-archive.js` | **Change**: old records retained; record Archive UI removed | ☐ |
| 7.8 | Create a Revision at the bottom of a part page: prompt for What changed, Why did you change it, Notes and named photos, then capture the saved part/instructions/records/local bytes; automatic date; preserve previous level and advance the working part to the next numbered revision | `part-revisions.js`, `part-revision-snapshot.js`, `/api/investigations` | **Keep**: one dated chevron entry per saved revision and Create a Revision; Edit part details offers Save as revision (copy previous version and advance) or Save (overwrite without advancing). Legacy repair; D1 preview alignment remains pending | ☐ |
| 7.9 | Open subassembly instructions from a BOM line | `SA` | | ☐ |
| 7.10 | Suggestion review queue: suggest a Work Instruction name change, owner reviews and rejects/accepts | `project-review.js` | **Drop** | ☐ |

## 8. History, archives and recovery

| # | Feature | Code today | Decision | Rebuilt |
|---|---|---|---|---|
| 8.1 | History includes parent-scoped Archive folder for tree removals; part Revisions stays separate; earlier saved records remain readable | `investigations.js`, `part-revisions.js`, `SA`, `/api/workspace-history` | Later History redesign remains pending; owner requires a separate Create a Revision action at the part-page bottom | ☐ |
| 8.2 | History → Archive (parts/subassemblies): original location, explanation/photos, children, saved records/files, readable details, Restore to build | `tree-archive.js`, `/api/assembly-archive` | Owner refinement: parent-scoped History → Archive; no new iteration or permanent-delete UI | ☐ |
| 8.3 | Recent changes: automatic changed-save workspace snapshots, list/load older and partial "Load this version" | `SA`, `/api/workspace`, `workspace-history.js` | **Drop in new engine**: History and deliberate Revisions replace this presentation; no automatic per-save timeline or promised full-part undo. Keep legacy behavior until cutover; any per-save undo is a separate explicit feature. | ☐ |
| 8.4 | Project backups: download a project backup (JSON) and a readable HTML backup (print to PDF) | `SA`, `project-readable-backup.js`, `/api/project` | | ☐ |
| 8.5 | Scheduled automatic backups of all projects (cron) | `worker.js` `scheduled`, `automatic-backups.js` | | ☐ |
| 8.6 | Backup integrity checks (checksums, size limits, project match) | `archive-check.js`, `local-project.js` | | ☐ |

## 9. Photos (shared)

| # | Feature | Code today | Decision | Rebuilt |
|---|---|---|---|---|
| 9.1 | Photo editor: pen, highlight, arrow, circle, text (move, size), crop, colour, undo/redo, reset, autosave of edits (originals kept) | `photo-markup.js`, `/api/photo-annotations` | | ☐ |
| 9.2 | Paste image from clipboard (Ctrl+V) and drag-and-drop | `photo-markup.js`, `photo-editor.js` | | ☐ |
| 9.3 | Photo viewer (full-size, previous/next) | `photo-viewer.js` | | ☐ |
| 9.4 | HEIC handling message | `photo-markup.js` | | ☐ |

## 10. Calculators

| # | Feature | Code today | Decision | Rebuilt |
|---|---|---|---|---|
| 10.1 | Calculators: Ohm's law, surface speed (SFM), wheel surface speed | `resources.js`, `calculator-directory.js`, shared directory modules | **Keep**: searchable directory with shared descriptor filters, alphabetical sorting and Details/List/Tiles views; existing forms retained | ☐ |

## 11. Leftovers to remove (no rebuild)

These exist in code but serve features the owner has removed or never uses. *Suggest: delete as a cleanup PR before the rebuild.*

| # | Item | Code today | Decision |
|---|---|---|---|
| 11.1 | `assets/work-tracker.js` (Continue working / tasks / parts checklist) | not loaded by any page | **Drop** |
| 11.2 | `assets/site-components.js` | not loaded by any page | **Drop** |
| 11.3 | My Build personal notes and "stuck / confused" feedback | `my-build.js`, `/api/my-build`, `/api/build-confusion`; still called from `SA` (`BSMyBuild.insights`, `reportControl`) | **Drop** |
| 11.4 | Proposals API | `/api/proposals` | **Drop** |
| 11.5 | Project tasks API (its only caller is the unloaded `work-tracker.js`) | `/api/project-tasks` | **Drop** |
| 11.6 | Old Workshop category data in `resources.js`. Legacy Helpful tools still reads existing `resources.parts` and offers static tools; linked-part snapshots/photos/export and wire/harness consumers remain. Hiding new Workshop-part choices does not remove these readers. | `resources.js`, `SA`, `site.js`, legacy linked-part readers | **Drop after replacement**: D1 Workshop tools picker and Workshop-wire harness work must replace consumers first. Do not migrate legacy `resources.parts`; report their counts per project at cutover. |
| 11.7 | The `#learn` view name, now only hosting Calculators | `index.html`, `site.js` | **Drop** |
| 11.8 | Hard-coded legacy project sections `#launcher`, `#linear`, `#robot` and their 365+ ID-based CSS rules | `index.html`, legacy CSS | **Drop** |
| 11.9 | Baseline audit: 893 candidate selectors (271 unmatched classes); 359 reviewed selectors removed in CSS batch #45, remaining candidates require review | legacy CSS files, `scripts/css-retired.json` | **Drop** |

## 12. Already on the new system (for completeness)

- **Workshop** (`workshop.html`): categories → families → products → uses; specifications; family photos and files; related Knowledge.
- **Knowledge** (`knowledge.html`): tiles (concept, method, lesson; Draft/Verified), sources, links to tiles, families, products, uses, projects and records; Linked-from; related-knowledge rule.

Still planned there: files and photos on tiles; "Make this a knowledge tile" on records.

---

**Not covered by a code read:** behaviour that only exists in data (for example particular Workshop seeds) or in the owner's habits. The owner should add anything they use that is missing here.

## Current CSS batch coverage

PR #45 touches 1.1 (shared header), 1.10 (tooltip interaction), 2.2–2.7 (toolbar presentation), 4.1–4.5 / 4.7 (shared collapsed summary sections), 5.1 / 5.4 (help and leading status indicators), 6.13 / 7.4 (consistent empty action sections), and 11.9 (reviewed dead styles). Existing feature behavior is retained. None of these full feature areas is marked Rebuilt solely because its styling changed.

Part-details information tiles are covered by the follow-up below. Resizable Workshop/Knowledge columns are covered by the shared pane batch below.

## Implementation interpretation

The owner authorized implementation and production deployment of these decisions. Blank decisions preserve behavior; this is an area-by-area migration, not permission to silently omit Keep items. Stable built-in project IDs remain valid when their duplicated page markup is replaced. Project data and attachments are retained. That cleanup did not enable provider calls; the subsequent owner-requested lookup-resume change is separate.

The first implementation batch removes visibility/permission controls and publishing paths, administrator-password linking, the suggestion queue and API, personal My Build / stuck-feedback code and APIs, and unloaded work-tracker/site-components scripts. It adds per-browser, per-project summary disclosure preferences with collapsed first visits. Removed runtime code has corresponding CSS removed in the same batch. Ordinary sign-in/out, private project edits, numbering, backups, DigiKey purchasing and revision history remain.

Separate functional batches replace the wire library with Workshop products, remove the old Workshop resource catalog while preserving calculators/resource linking, replace repeated built-in page markup while preserving IDs, and enforce the strict class-producer check with reviewed dynamic patterns. The History wording and views require the existing History design, not a blanket rename of unrelated archives. These items are not marked Rebuilt until live behavior is checked.


Practice-to-Notes implementation: existing Practice records become Notes on the next owner read or write, after their raw store has been backed up and verified. Their former practice/learning fields remain readable, labeled and retained when the Note is edited. No new Practice records can be created. Storage contention or backup failure stops the conversion and reports a retryable error.


Project shell/CSS implementation: all projects instantiate one workspace template and one project-card renderer. Original launcher/linear/robot IDs remain as stable data and link identifiers. They no longer own separate HTML sections or CSS selectors. Template field IDs and label/ARIA references are made unique per project. The strict class-producer check follows loaded browser code and uses an explicit, narrow dynamic-class allowlist; retired positive and boolean-pseudo branches are removed without discarding live selector alternatives.


Implementation boundary after the first batches: deleting the old wire API/catalog immediately would violate the inventory's no-reader condition. The current cutting-list renderer still calls /api/wires, and functions/api/workshop-linked-part.js imports the static resources catalog for legacy snapshots, photos and backup dependencies. These are live readers, not unloaded leftovers. Keep them until Workshop-product cutting lists and the source/snapshot reads are replaced and tested together; do not simply delete them. Component extraction stays disabled. The owner-requested part lookup resume uses the existing provider cap and a daily attempt guard; its Workshop-specific redesign remains separate work. The History decisions remain an area rebuild, not a promise that changing a label rebuilds its process.

The old learn view is removed: Calculators now uses #calculators, including links from workspaces and the active header state. The calculator directory shares the project directory renderer and descriptor filters, with search by name, purpose and units; Name A–Z/Z–A sorting; and Details/List/Tiles views. Calculator view preference is separate from Projects. Opening a result shows its existing form; returning to results retains the search, filters and in-page input values. The three existing calculation forms and formulas are retained.

Part information batch (6.3–6.5): reference/selected-product information and project-owned information now use the same static shared tile and field-row helpers. The rendering is extracted from site-assembly.js into part-information.js, loaded through a literal dynamic import. Purpose saves, alternative selection, supplier links and project annotations retain existing API protection. D1 projections expose product facts and project requirements separately; false, zero and hidden stored values are retained. No stored data changes or deletions. Full part-page rebuilding remains incomplete.

Workshop/Knowledge pane batch: categories/families/details and tiles/details now have shared accessible resizers, per-browser remembered widths, a reset gesture and responsive stacked layouts. Existing category actions, searches and detail forms keep their DOM and handlers. Preferences contain only numeric widths; there is no API, schema, engineering-data or backup-format change.


## Rewrite preparation (Batch 0)

The approved D1 plan and first custom-part acceptance flows are in `HISTORY_REWRITE_PLAN.md` and `BATCH0_CUSTOM_PART_SPEC.md`. No legacy project feature is marked Rebuilt by this preparation. Section 10 legacy Workshop editors for common/purchased parts are no longer called from the browser; current family/product Workshop and the server reference catalogue remain. Current project data is untouched. Preview engine work must pass the real-D1 transaction gate before dependent flows are built.

Independent preparation for 6.6/6.14 and History: the pure custom-part model validates separated detail/build fields, stable specification IDs, numbering and typed before/after comparison. It is used by the existing transaction proof fixture, not the production editor. No feature is marked Rebuilt and the real-D1 gate is unchanged.

Historical Batch 1 evidence: seven actual preview-D1 command checks plus same-proof replay, with one event/two configurations/three receipts retained in `PROJECT_ENGINE_D1_PROOF.json`. The receipt identifies its proven runtime; later main-alignment heads still need targeted review and deployment-specific verification. This marks no legacy UI feature Rebuilt and does not activate production.

The current owner UI requirements and stale-handoff reconciliations are maintained in `UI_STANDARDS.md`. Shared gutter/header/help/section-action changes cover Workshop and Knowledge now; summary, identity/name limit, alternatives, compact Parts Management and settings remain engine acceptance work after stack integration. Revisions stays separate, and Calculator topics remain even though engine project tags are dropped. PR #68 owns the renamed Tiles and searchable Calculator implementation; PR #67 owns the photo-read reliability fix. No engine inventory line is marked rebuilt by this shared presentation batch.

Work Instructions revision reuse is implemented for gated Batch 4a review in `HISTORY_REWRITE_PLAN.md`: individual instructions and header/group subtrees share the existing explanation/commit/snapshot mechanisms with independent counters and complete recovery. New coverage touches 7.1/7.3–7.8: nested group/record membership and sibling order, named per-prompt attachments, Photos/problem resolution, original record context/audits and instruction archive reasons/restore. No Rebuilt box is checked: dedicated instruction-list resizing, legacy conversion, Knowledge/Milestone draft actions, full History interaction (4b), real-D1 measurement and owner acceptance remain outstanding. These changes do not replace the production engine.

Custom-part preview status: `PROJECT_CUSTOM_FLOW.md` and `PROJECT_CUSTOM_FLOW_PROOF.json` record the new single-root/custom-part flow, full CI checks and actual Cloudflare restore into an independent empty D1 database. All Rebuilt boxes stay unchecked: this slice has not replaced the production engine or the retained rich Work Instructions, purchasing, nested assemblies, Knowledge and media features. The next gate is owner preview review.

PR #53 evidence-integrity follow-up touches 7.4/7.5 and 8.1: editing a record retains an immutable before/after History event with original tested design/build context and both attachment sets. Current record and Knowledge identities stay stable, retries do not duplicate edits, and failed audit writes roll back the edit. Legacy captures remain unchanged and recovery includes the audit. No Rebuilt box is checked and no production engine activation is claimed.

Batch 4b touches 8.1/8.2 presentation: explicit part/instruction revision types, scope/search/counts/paging, read-only saved/working comparisons, original context and named record attachments, Archive type/reason filters, and selection/scroll retained across edit and part navigation. It uses the existing read and guarded restore APIs unchanged. No schema/backup/save behavior or owner Rebuilt box changes; full legacy parity and real-D1 acceptance remain pending.

The same PR's recovery follow-up touches 8.1/8.2 and project backup/restore: the normal engine picker restores a named separate project beside an existing source, with independent files, exact retry and fixed original evidence context. Original-identity import still refuses existing targets. Platform capacity/live acceptance and production cutover remain pending; no Rebuilt box is checked.

PR #65 reconciles 5.8, 7.8 and 8.1/8.2 on the gated engine: numbered full-part checkpoints, standard Save versus Save as revision, a single dated/change-labeled disclosure per saved copy, and tree Archive/restore with consumed zero-padding aliases. Full copies retain original test context, immutable record edits and attachment ownership; design identity excludes the checkpoint counter. No production parity box is checked and independent file revisions remain deferred.

Batch 3 reconciliation: nested subassemblies/ordered placements, project-owned frozen Workshop selections, separate requirements, nested BOM totals, full assembly evidence, grouped Archive/restore and the Workshop project-use reader remain isolated preview work in #66. Assembly configuration identity is design-only; exact placements, quantity/build state, visibility, attention and tested part levels are retained separately with evidence. Historical proof files stay pinned to their tested runtimes. Exact-head CI, targeted review and fresh binding/capacity acceptance are still required; no production Rebuilt box is checked.

Review and proof workflow: `PREVIEW_ACCEPTANCE.md` records the bug-fix-only legacy policy, review order and explicit scripted acceptance action. Current revision numbers are labeled working drafts; saved copies stay fixed, and narrative Change records do not create numbered part revisions. Full Work Instructions/records parity remains queued pending integration of the reviewed foundation stack.
