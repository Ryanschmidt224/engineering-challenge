> Retained Claude source analysis. The owner's later early-live plan in STATUS.md and HISTORY_REWRITE_PLAN.md controls scope and sequencing; this source's commit/status/disposition recommendations are historical, not deployment authorization.

# Batch 6 disposition prep: read-only source mapping

Prepared 2026-11-24 by Claude from main `fe3a107` and PR #71 `b1ea81d`. No data was read, converted or deleted.

**Every count below is `not yet measured`.** The counts need an authorized export, or a read-only inventory run by the owner on real storage. This document describes where legacy data lives and what has to be decided about it. It does not say what exists.

## 1. Where legacy project data lives

All legacy project data sits in the R2 `PHOTOS` bucket. The authoritative list of keys is `assets/archive-layout.js`, which the Worker, the offline editor, the verifier and the CLI all share.

| Kind | Key pattern | Owner module | Engine counterpart |
|---|---|---|---|
| Project catalog (name, archived flag, tags, visibility) | `project-catalog/v1.json` (one file for all projects) | `projects.js` | `engine_projects` |
| Project profile | `project-profile/<p>.json` | `project-archive.js` | `engine_projects` |
| Tree (assemblies, parts, order) | `trees/<p>.json` | `tree.js` | `engine_items` + `engine_occurrences` |
| Components (part details, suppliers, specs, Workshop links) | `components/<p>.json` | many readers | `engine_items.fields`, `engine_selections` |
| Assembly pages and status | `assembly-pages/<p>/…`, `assembly-status/<p>/…` | `tree.js` | occurrences build fields; 4.2 / 5.10 |
| Work Instructions | `workspaces/<p>/…`, `part-workspaces/<p>/…` | `workspace.js` | `engine_steps` |
| Records (incl. Practice) | `investigations/<p>.json` | `investigations.js` | `engine_records` + events |
| Record migrations | `record-migrations/<p>/…` | `record-upgrades.js` | — (conversion provenance) |
| Part revisions | `part-revisions/<p>/…` | `part-revision-save.js` | revision events + `engine_snapshot_values` |
| Archive (tree removals) | `assembly-archives/<p>/…` | `assembly-archive.js` | `engine_archive_groups` + events |
| Recent changes (dropped feature, 8.3) | `workspace-history/<p>/…` | `workspace-history.js` | none, by decision |
| Milestones | `project-milestones/<p>.json` | `project-milestones.js` | none yet (5c) |
| Scratch notes | `unstructured-notes/<p>/…` | `unstructured-notes.js` | none yet (5c) |
| Numbering | `project-numbering/<p>.json` | `numbering.js` | `engine_projects.prefix/digits`; reserved numbers |
| Settings | `project-settings/<p>.json` | `tree.js` | `engine_projects` |
| Photos | `<p>/…`, `component-thumbnails/<p>/…`, `recipe-files/<p>/…` | `photos.js`, `recipe-files.js` | `engine_files` (+ 5c `engine_item_files`) |
| Photo edits | `photo-annotations/<source>/…`, `photo-renders/<source>/…` | `photo-annotations.js` | 5c derived files |
| Part files, saved webpages | `part-files/<p>/…`, `part-pages/<p>/…` | `part-files.js`, `part-pages.js` | 5c |
| Drawings | `drawings/<p>/…` | `drawings.js` | 5c |
| Source code | `part-code/<p>/…` | `part-code.js` | 5c |
| Harnesses | `harnesses/<p>/…` + `libraries/wires.json` | `wires.js` | 5b harness on Workshop wire |
| Proposals (dropped feature) | `change-proposals/<p>.json` | removed | none |
| Workshop dependency copies | `workshop-dependencies/<p>/…`, `workshop-reference-photos/…` | `archive-workshop.js` | Workshop D1 (shared, kept) |
| Automatic backups | `automatic-backups/…` | `automatic-backups.js` | keep as-is (see §4) |

**D1 references into legacy projects. These live outside project storage and survive the cutover.**

- **Knowledge links.** `knowledge_links(target_type, target_id, target_project_id)` uses target types `tile`, `family`, `product`, `use`, `project` and `record` (`knowledge-targets.js`). The project, use and record types can point into legacy projects; there is no part-level type, so 6.12 "tiles linked to this part" goes through Workshop uses and records. Every link whose `target_project_id` is a legacy project needs a decision.
- **Workshop uses.** `workshop_uses.project_id` (with an `archived` flag). The engine now writes its own uses through `project-selection-uses.js`. Legacy rows that point at legacy projects need a decision.

## 2. Existing read and export paths (no new code needed)

| Path | What it gives | Limits / notes |
|---|---|---|
| `/api/project/archive` (`project-archive.js`) | Read-only, lossless JSON envelope, with every allowed key's bytes base64-encoded, plus Workshop dependencies | **`MAX_OBJECTS=1500` per project.** A large photo-heavy project may refuse to export. If it does, check this first. |
| Readable HTML backup (`project-readable-backup.js`) | A printable record for the owner | Readable only; it can't be restored |
| `automatic-backups/` (cron) | Scheduled legacy backups | Already exists; keep through cutover |
| Validation-only import (`project-archive.js`) | Verifies an envelope without writing anything | Useful as the "export verified" proof |

## 3. Read-only inventory to run before deciding

These are the facts the owner needs. The **owner** runs the job, or authorizes it, against production storage. It is read-only: it lists keys and reads JSON, and writes nothing.

1. Per project in `project-catalog/v1.json`:
   - id, name, archived flag, created date
   - **last-modified time** of the newest object under its prefixes (the best single "is this real?" signal)
2. Per project, object counts and bytes for each row of the §1 table.
3. Records by type, **including the Practice count**. Practice converts to Notes (7.4).
4. Knowledge links per legacy project, by target type. Also list the tiles that link *only* into legacy projects.
5. Legacy `workshop_uses` rows per project.
6. Projects where the legacy export would exceed 1,500 objects.
7. Harnesses per project, and whether each wire maps to a Workshop wire product.

**Where to run it:** an owner-run `GET` endpoint behind admin auth in preview builds only, or the existing local CLI against an exported envelope. In both cases nothing is written.

## 4. Decisions the owner makes at cutover (one line each)

| # | Decision | Default recommended in the plan |
|---|---|---|
| D1 | Per project: **import**, **keep read-only legacy export only**, or **retire** | Fresh start *only if* §3 shows the data is disposable. Don't assume BuildABoard or newer projects are. |
| D2 | Practice records (if any are imported): convert to Notes, keeping the old fields labeled | Approved (7.4) |
| D3 | Knowledge links into retired projects: keep as a label-only link, relink to the imported engine item, or remove the link | Relink when the project is imported; otherwise keep the label so tiles don't lose context |
| D4 | Legacy `workshop_uses` rows | Mark archived for retired projects; recreate through the engine for imported ones |
| D5 | Legacy automatic backups and envelopes | **Keep them all.** Never part of cleanup |
| D6 | When to delete legacy code and R2 prefixes | Only after D1–D5 are done and every kept project has a verified export. This needs separate explicit approval. |
| D7 | Legacy hash links (`#<project>/part/<id>`) | Redirect imported ones (needs an ID map from the import); show a "retired project" page for the rest |

## 5. If any project is imported (a separate, tested job, not part of Batch 6 prep)

- Mapping per §1. Keep stable IDs where the engine accepts them, and keep original timestamps.
- Legacy part revisions and archive copies become **frozen historical events.** Don't reconstruct them as editable state.
- Unknown or unparseable legacy content is kept as an attached original JSON file on the item, so nothing is lost silently.
- A dry run produces a per-project report (counts in vs counts out, unmapped keys). The owner reviews it before any live import.
- One writer per project. Freeze legacy edits for that project before importing it.

## 6. Not yet measured

Every count. Which projects are real. Whether any project exceeds the 1,500-object export limit. How many Knowledge tiles link only into legacy projects. These come from §3, not from source code.

