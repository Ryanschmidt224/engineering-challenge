# Batch 0: owner decisions and the custom-part flow spec

Claude · 2026-11-22 · For Codex/ChatGPT. Companion to Codex's *History Rewrite Plan* (v1) and Claude's review of it.

---

## Part A: Owner decisions (2026-11-22)

The owner agreed with every point in Claude's review of the History Rewrite Plan:

1. **Direction approved:** D1 for structured project state and History, R2 for immutable file bytes, Cloudflare hosting unchanged.
2. **Editing (owner refinement, November 23):** **Create a Revision** is a separate action in Revisions at the bottom of the part page. It saves the entire currently saved part as historical context with an automatic date, leaves the working part unchanged and opens no editor. The owner modifies the working part afterward through the normal details editor. Archiving moves an entry out of its active section; it is separate from revision creation. **Change selected product** remains a separate action (Batch 3).
3. **Duplicating a part creates an independent item.** Placements share an item only when explicitly intended.
4. **Fast path at Batch 6:**
   - If the legacy-data inventory confirms nothing needs keeping: export every old project (with restore proven), cut over in one release, then delete legacy code and data.
   - Codex's two-engine production trial (Batch 7 routing, read-only legacy engine) is not built unless the inventory shows something must be kept.
5. **Old code and old data are deleted at the end.**
   - Code goes in the cutover PRs.
   - Data deletion is one deliberate, reviewed operation after cutover and verified exports. It never comes as a side effect of a merge.
   - **No project data is deleted before then.** The current site still runs on it.
6. **Small cleanup PR now, independent of the rewrite:**
   - remove the three browser `fetch` calls to retired routes in `assets/resources.js` (lines ~259, ~544, ~687); the server import of `resources.js` stays until Batch 8
   - add the legacy-JS no-growth check
   - fold dated docs into current docs
7. **New-engine routes are gated** by an environment flag set only in the `previews` block of `wrangler.jsonc` (for example `NEW_PROJECT_ENGINE=1`). Production returns 404 for them until the owner approves the switch. Additive migrations may merge; nothing in production writes to the new tables before approval.
8. **Permanent deletion (purge) is out of scope** until the later batch. Codex's plan stands.

Commit Codex's plan as `docs/HISTORY_REWRITE_PLAN.md` with these decisions recorded at the top, and mark the earlier redesign and rewrite documents as superseded.

---

## Part B: Spec for the first complete flow (Batches 1–2)

**November 23 refinement:** Part A.2 supersedes the original Save as revision editor and F4 interaction below. The existing D1 preview still implements that earlier interaction; align it in a focused preview refinement before marking the new flow accepted. A separate repair supplies Create a Revision on the existing live R2 part page. The major cutover gate remains unchanged.


### B1. Scope

**In scope:**
- One project with one top-level assembly (the project root) and **custom parts**: no Workshop family/product yet.
- Each part's work instructions (steps) and records (test, problem, note, change note).
- One engineering file per part (drawing/CAD/photo), replaceable.
- Save details, Save as revision, History, Removed items, remove/restore, retire/restore step.
- Export and real restore of this slice.

**Out of scope (later batches):**
- Workshop items and Change selected product (Batch 3)
- nested assemblies and assembly-level records (Batch 3)
- BOM, parts management, DigiKey (Batch 5)
- photo markup, drawings viewer, code files, harness (Batch 5)
- milestones and unstructured notes (Batch 5)
- Knowledge "Make tile" (Batch 4)
- purge (later)

**Where it runs:** a new ES-module page (for example `project.html`) on the preview deployment only, behind the flag. Projects are created through the API; no built-in sample IDs.

**Built from:** the shared site header, `ui-section`, the field-row/information tiles from PR #49, `ui-button`/`ui-control`/`ui-chip`, the shared dialog, and `split-panes.js` for the tree and the History list/detail. No new CSS for things the kit already provides.

### B2. Data carried from today's part (custom kind only)

Each field is listed with where it lives in the new model. Field names are illustrative; the meaning is what matters.

| Field | Today (`components.js` input) | New home | Rules |
|---|---|---|---|
| Name | `name` | `project_items.name` | Required, 1–180 chars |
| Short tree name | `treeDescription` | `project_items.short_name` | Optional, ≤20 chars; tree shows it if set |
| Part number | `partNumber`, `assignNumber` | `project_items.part_number` | Auto from the project's numbering (prefix + digits, today's format) or typed; unique per project across **active and removed** items; never renumbered silently |
| Kind | `itemType` / `partType` | `project_items.kind` = `part` / `document` / `code`; `source` = `custom` | Batch 2 needs `part`; `document` must be accepted by the schema |
| Description | `description` | `project_items.fields.description` | ≤5,000 chars |
| Purpose / function | `purpose`, `functionalRequirements` | `project_items.fields.purpose` | Optional |
| Specifications | `specifications` | `project_items.fields.specs[]` = `{field_id, label, value, unit}` | Stable `field_id` per row; keep the false / 0 / empty / unset distinction |
| Acceptance criteria | `acceptanceCriteria` | `project_items.fields.acceptance` | Optional |
| Is a tool | `isTool` | `project_items.is_tool` | Boolean, explicit; no guessing from the name |
| Manufacturer / MPN | `manufacturer`, `model` | `fields` (custom-purchased parts) | Optional |
| Quantity + unit | `quantity`, `quantityUnit` | `occurrences.quantity`, `.unit` | ≥0; default 1 pcs |
| Status | `progressStatus` | `occurrences.build_status` = not started / in progress / complete | Occurrence-level |
| Needs attention + note | `needsAttention`, `attentionNote` | `occurrences.attention`, `.attention_note` | Occurrence-level; note ≤2,500 |
| Hidden in tree | `hideFromFeatureTree` | `occurrences.hidden` | |
| Part picture / file | thumbnails, part-files | `files` + `file_links(role='picture'/'drawing')` | Immutable; replace = new file |

**Not carried:** `workshopChoice`, `sharedPartRef`, `implementation*`, `purchaseOverride`, `supplierOffers` (Batch 3/5), `progressOperation*` (the retired operations editor), and legacy `experiments` / `appliedProposals`.

### B3. Screens

1. **Project page:** shared header; feature tree on the left (resizable with `split-panes.js`, remembered width); content on the right. Tree rows show short name or name, the status mark (`ui-status-mark`), and quantity when >1.
2. **Part page, top to bottom:**
   - **Header:** picture (or "No picture yet"), name, part number, status select, Needs attention, quantity.
   - **Part details:** read-only information tiles with **Edit details** and a **More** menu (Remove from build…, Duplicate).
   - **Work instructions:** ordered steps. Each step lists its records and has **Add record**; steps can be reordered and renamed, and have Retire step.
   - **History:** the latest 5 entries for this item, **View all history**, **Add record**.
3. **Details editor (dialog or inline panel):** all B2 fields, then **Save as revision** (off by default). When on, it shows:
   - **What will change:** only the changed fields, old → new, with labels and units
   - an optional reason, an optional label (for example a drawing revision letter), and optional supporting files

   The buttons are **Save changes** / **Save revision** (the label follows the choice) and **Cancel**.
4. **Record editor:** type chips Test / Problem / Note / Change note, with prompts per type:
   - Test: what was checked, method, result
   - Problem: what happened, suspected cause, resolution, status Open/Resolved
   - Note: text and/or attachments
   - Change note: what changed and why

   At least one meaningful field or one attachment is required. Timestamp is automatic; event date is optional and explicit.
5. **Project History page:**
   - **History / Removed items** switch, scope selector (This item / Whole project), type filter (All, Tests, Problems, Changes, Notes), search.
   - One list and one detail pane (`split-panes.js`); on a phone, full-width detail with **Back to history**.
   - Rows show title, type label, source item, a one-line outcome and a subdued time. There are no per-row action buttons.
6. **Removed items detail:** read-only view (name, original location path, specs, steps, records, files), with **Restore…**. Restore opens a preview of the destination and any conflicts, then commits.

### B4. Flows and acceptance

Each flow must pass on preview D1/R2 at desktop and 390 px, by keyboard and touch. The codes refer to Codex's acceptance list.

| # | Flow | Must hold |
|---|---|---|
| F1 | Create project → create custom part (auto number) | Number follows the project's format; the part appears in the tree; an initial configuration is captured |
| F2 | Edit details, Save changes | No History event; current view updates; a stale tab gets 409 and keeps its draft (SAVE 03, 05); unchanged save writes nothing (SAVE 02) |
| F3 | Add step → Add record (Test) | The record links to the **current** configuration, including values from F2's ordinary edit (HIST 01, 02) |
| F4 | Edit details with Save as revision, reason "Thicker for stiffness", change 3 mm → 5 mm | One event, one new configuration, before/after shown (SAVE 04). Cancel → nothing written (SAVE 01). Lost response + retry → still one event (SAVE 08). Same operation ID with a different body → 409 (SAVE 09). Stale guard → nothing written (SAVE 10) |
| F5 | Open the F3 test from History | Shows the configuration it was run on (3 mm), not the current 5 mm, with **View previous details** |
| F6 | Replace the part's drawing | The old configuration still opens the old file bytes (FILE 01); an interrupted upload leaves no broken link (FILE 02) |
| F7 | More → Remove from build → Undo removal; then remove again and restore from Removed items | No R2 copies (object count unchanged); the original path stays readable after renaming the root; restore checks number/ID conflicts; retry gives one event (REMOVE 01, 04–07) |
| F8 | Retire step → restore step | Its records keep their IDs and remain in History (REMOVE 08, HIST 05) |
| F9 | History page: filter Tests, search "stiff", open detail, go back | Scope, filter, selection and scroll are preserved; equal timestamps paginate stably (HIST 06, 07) |
| F10 | Export project → restore into an empty preview project | IDs, fields, configurations, records, events, file links and file hashes are identical; revision tokens are reset (RECOVER 01–03) |
| F11 | Signed out | Every new route returns 401, and files are not reachable (FILE 03) |

### B5. API for this slice (names illustrative; one convention for all new routes)

```
POST  projects                          create (name, numbering prefix/digits)
GET   projects/:p/tree                  occurrences + items (active)
POST  items (in project)                create custom item + occurrence under root
GET   items/:id                         current details + current configuration id
PATCH items/:id                         Save changes  {expectedRevision, operationId, fields}
POST  items/:id/revisions               Save revision {expectedRevision, operationId, fields, reason?, label?, fileIds?}
POST  steps / PATCH steps/:id / POST steps/:id/retire|restore
POST  records / PATCH records/:id       records capture configuration server-side
POST  occurrences/:id/remove | GET …/restore-preview | POST …/restore
GET   projects/:p/history?scope&type&q&cursor
GET   projects/:p/removed
GET   configurations/:id                read-only snapshot
POST  files/prepare → PUT bytes → POST files/:id/admit
GET   projects/:p/export  ·  POST projects/:p/import (preflight + restore)
```

Every write needs an owner session, same-origin, `expectedRevision` and `operationId`. The guarded-batch pattern is in Claude's review, section 4.2, and must be proven on preview D1 in Batch 1 before anything else uses it.

### B6. Demo for the owner at the end of Batch 2

On the preview URL, a 5-minute walkthrough:
1. Create a bracket part.
2. Record a test.
3. Save a revision 3 → 5 mm.
4. Open the old test and see 3 mm.
5. Replace the drawing.
6. Remove the part and undo.
7. Retire and restore a step.
8. Find everything on the History page.
9. Export and restore.

Show the same at phone width. The owner then approves Batch 3.
