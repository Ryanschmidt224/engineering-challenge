> Retained Claude source analysis. The owner's later early-live plan in STATUS.md and HISTORY_REWRITE_PLAN.md controls scope and sequencing; this source's commit/status/disposition recommendations are historical, not deployment authorization.

# Batch 5 implementation brief

**Prepared:** 2026-11-24 by Claude. This is read-only analysis; no code was changed.

**Source state:**
- main `fe3a107`
- engine features as of PR #71 `b1ea81d` (Batch 4a, approved)
- 4b not started

**Companion file:** `BATCH5_FEATURE_MAP.csv`. It has one row per inventory line, with source references.

## Summary

The map has 83 rows:

| Status | Rows |
|---|---|
| Implemented | ~27 |
| Partial | ~19 |
| Missing | ~28 |
| Unverified | 2 |
| Owner Drops | 7 |

**Batch 5 is bigger than the 5-day target.** One writer needs **roughly 10–13 working days** for all Keep and Change rows. The heaviest areas are:
- media and files
- alternatives and identity
- project-level data
- Knowledge links

**Recommendation:** split Batch 5 into **three sequential PRs** (5a → 5b → 5c), each merged before the next starts. One PR covering ten days of mixed UI and data changes would be the hardest possible review.
- **5a is UI-only** and can self-merge under the speed policy.
- **5b and 5c carry the data changes**, bundled so Claude reviews **two** migrations rather than six.

## A schema constraint that shapes everything (read first)

**Files can't take new roles without a table change.**
- `engine_file_links.role` has `CHECK(role IN ('engineering','support'))`.
- `engine_current_file` is a unique index on `(project_id,item_id) WHERE item_id IS NOT NULL AND active=1`. That allows **one active item-level file per part, whatever its role**.
- SQLite can't alter a CHECK in place. Rebuilding `engine_file_links` means rebuilding a table that carries the v7–v9 retired-restore triggers, which breaks the schema-9 freeze.

**Smallest safe route:** a **new table** `engine_item_files`:
- **Columns:** `project_id, id, item_id NULL, file_id, role, sort_order, caption, derived_from_file_id NULL, active, created_at`.
- **Roles:** `project_photo, part_picture, photo, drawing, part_file, webpage, code`.
- `item_id NULL` means project scope.
- Leave `engine_file_links` and the one-engineering-file rule untouched.

**Byte safety holds without changes.** The orphan root check already protects any admitted `engine_files` row (`NOT EXISTS engine_files f WHERE f.r2_key=key`), so the new table needs no cleanup changes.

**The new table must be added to:**
- the backup columns, plus defaults (`project-backup-schema.js`),
- the outline streaming list (`project-backup-stream.js`),
- the staged-restore publish comparison.

This is the same kind of feature-metadata compatibility change PR #71 made. It is allowed under the freeze, but it is **review-gated**.

## Ordered work

| PR | Group | Inventory rows | Reuse | New / changed files | Data? | Estimate |
|---|---|---|---|---|---|---|
| **5a** | Project list and shell | 2.3, 2.4, 2.8, 2.9, 1.2, 1.3, 1.6, 3.1 (limit text), 3.5 (number preview) | `project-directory.js`/`.css` (already shared with Calculators), the project-manager sign-in component, `allocatePartNumber` | `project-workspace.js` `projectList()`, a small `project-signin.js` | UI-only | 1 d |
| 5a | Build views | 4.3 (summary BOM + Tools), 5.3 (show/hide documents and Workshop items), 5.11 (list grouping; picture view after 5c), 5.14 Parts Management, 7.1 instruction-list resizing | `projectBOM`, `data-table.js`, `split-panes.js`, `editItem` | new `project-parts-management.js`; `project-bom-view.js`, `project-tree-view.js`, `project-instructions.js` | UI-only | 1.5 d |
| 5a | Read-only outputs | 8.4 readable HTML backup, 6.15 copy to Workshop draft | `project-readable-backup.js`, `project-product-copy.js` (port both to `client.state`) | new `project-readable-export.js`; reuse the existing `/api/workshop` | UI-only | 1 d |
| **5b** | Identity and alternatives | 6.6 (remove the short_name UI and state, `PART_NAME_MAX=20` for new or edited names, part-type select), 6.4 alternatives + guarded select | ALTERNATIVE_PARTS_SPEC, Workshop selection snapshot code (`project-workshop.js`), `commitProjectCommand` | **migration 11**: `engine_alternatives` table. Keep the `short_name` column (stop writing it; backups still carry it). New `project-alternatives.js` (API + view) | **Data**: Claude review | 2 d |
| 5b | Item-field extensions (no migration: `items.fields` JSON) | 6.7 suppliers, 6.13 Helpful tools refs, 4.4 cost, 5.12 DigiKey cart, 5.13 harness on Workshop wire | `part-suppliers.js`, `bom-purchasing.js`, `normalizeCustomItem` (extend `only()` list + validators) | `project-item-model.js`, the editor sections, new `project-purchasing.js`, `project-harness.js` | **Data** (field schema + backup round-trip): review with 5b | 2 d |
| **5c** | Media and files | 4.1, 5.9, 6.2, 9.1–9.4, 6.9, 6.10, 6.11, 5.15 | `photo-markup.js` (`window.BSPhotoMarkup`, already loaded on `project.html`), `photo-viewer.js`, `project-files-zip.js`, the engine prepare/upload/admit client | **migration 12**: `engine_item_files` (above). New `project-media.js` (gallery/picture component), `project-part-files.js` (files, drawings, code, webpages) | **Data**: Claude review | 3 d |
| 5c | Project-level data | 4.2 description, 4.7 scratch notes, 4.5/4.6 milestones, 3.4/2.7 project archive | `editable()`, the History link helpers from 4b | **migration 12** (same one): `engine_projects` + `description`, `notes`, `archived_at`; `engine_milestones` (`id, project_id, kind intent/milestone, fields, source_event_id NULL, source_record_id NULL, created_at`) | **Data**: Claude review | 1.5 d |
| 5c | Knowledge links | 6.12 | `knowledge-targets.js` | Add an `engine_item` target type (project_id, item_id) and a part-page section | **Data** (Knowledge schema): review | 1 d |

## Per-group detail: success case and main failure case

**5a: Project list.**
- **Success:** search, sort and a view choice survive a reload.
- **Failure:** none worth adding (read-only).

**5a: Parts Management.**
- **Success:** filter by status, Edit, then Save updates the row.
- **Failure:** a stale edit shows the existing 409 review.

**5a: Readable export.**
- **Success:** the output lists every part, instruction, record and attachment name of a 2-part fixture.
- **Failure:** an archived part appears under its Archive heading, not as active.

**5b: Identity.**
- **Success:** a new 21-character name is refused. An existing 40-character name opens and saves unchanged.
- **Failure:** a duplicate submit of the rename replays once.
- Old backups that contain `short_name` still restore.

**5b: Alternatives.**
- **Success:** add a manual alternative (fields copied with blank values), select it, and the part shows it. History records the swap, and the backup round-trips it.
- **Failure:** selecting on a stale revision gets a 409, and nothing is swapped.

**5b: Purchasing.**
- **Success:** 3 rows with DigiKey codes give a cart with 3 lines.
- **Failure:** a row with no DigiKey code is listed as skipped, not silently dropped.

**5b: Harness.**
- **Success:** two runs of the same wire product combine into one line with the total length.
- **Failure:** a deleted or archived Workshop wire shows its last-known name.

**5c: Media.**
- **Success:** add 3 photos, caption one and annotate one. After a reload the order and caption hold, and the original is still downloadable.
- **Failure:** a lost upload response doesn't duplicate (reuse the 4a upload job).

**5c: Files and drawings.**
- **Success:** upload a STEP and an STL. Replacing the STL keeps the old one in History. "Delete" unlinks only; the bytes are kept.

**5c: Code.**
- **Success:** save twice, view v1, and restoring v1 creates v3.
- Each save is a new immutable file.

**5c: Milestones.**
- **Success:** add a milestone from a record. It links back, and a double-click creates only one.

**5c: Project archive.**
- **Success:** the wrong name is refused. The right name hides the project, and Restore brings it back.
- **Data:** no data is deleted.

**5c: Knowledge.**
- **Success:** create a new tile from a part. It lists the part, and the part lists the tile.

## Dependencies

- **4b must merge before 5a starts.** That keeps one writer, and 4.5/4.6 reuse 4b's History links.
- **5b must come before 5c's picture-based views.** The 5.11 picture view and the 2.1 card thumbnail need 5c's `part_picture` and `project_photo`, so land them in 5c.
- **6.4 comes before purchasing and cost.** HISTORY_REWRITE_PLAN item 5 orders alternatives before BOM/purchasing, so 5.12 and 4.4 read the selected alternative's suppliers.

## Owner decisions needed before or while 5a runs

None of these need code to answer. The CSV row is in brackets.

1. **[3.1] Project name limit:** keep the engine's 180, or return to 100?
2. **[3.6] Nomenclature guidance:** your UI review asked to remove it from settings. Drop it, or move it into a help ⓘ?
3. **[6.3] "Reload Workshop data":** selections are frozen by design. Is "Change Workshop selection" an acceptable replacement?
4. **[6.8] AI spec lookup** (Change row): defer it to Workshop product creation, outside Batch 5?
5. **[7.2] Autosave:** the engine uses explicit Save with an unsaved-changes warning. Accept that?
6. **[8.5] Scheduled automatic backups:** the legacy cron doesn't cover engine projects. **This conflicts with the schema-9 freeze.**
   - The simplest option is a cron that calls the *existing* engine export stream and writes one `.bsproject` per project to `automatic-backups/`. It adds no restore or recovery change.
   - The choices are: approve that, or defer it until after cutover. Without it, engine projects get no automatic backups after the switch.
7. **[3.4] "Delete project":** the legacy code only archives (`projects.js` L98–101), so rebuilding it as Archive does **not** conflict with the no-delete rule. Confirm the button keeps the "Delete" wording, or rename it to "Archive project".
8. **[5.11] "Standard shop materials" BOM section:** where its data comes from in the legacy code wasn't traced. Is it still used?
9. **[1.9] Value-symbol / Alt-code example popups:** still wanted on the new pages?

## Unknowns, and what resolves them

| Unknown | Resolve by |
|---|---|
| Whether the shared header offers Sign out on `project.html` (1.3) | Open the preview page while signed in. |
| How `bom-purchasing.js` builds the DigiKey request (form post or URL) | Read `assets/bom-purchasing.js` before porting (~15 min). |
| What drives the legacy shop-materials section (5.11) | Read `SA renderWorkspaceParts` and `bom-model.js`, or owner decision 8. |
| HEIC handling (9.4) | One upload test in the 5c media PR. |

## Realistic timeline

| Phase | Estimate |
|---|---|
| 4b | ~1 d |
| 5a | ~3.5 d |
| 5b | ~4 d, including the review round |
| 5c | ~5.5 d, including the review round |
| Batch 6 | ~1–2 d |

**That's about 15 working days in total, not 5.** To get close to 5, the owner would have to move whole groups after cutover. Natural candidates:
- 5.13 harness,
- 6.11 source code,
- 6.12 Knowledge links,
- 8.5 automatic backups,
- 2.9 views.

Two cautions if you do:
- Any group moved after cutover means the legacy pages keep serving that feature, or it's unavailable for a while.
- **Moving 8.5 is the riskiest**, because engine projects would then go without automatic backups.

