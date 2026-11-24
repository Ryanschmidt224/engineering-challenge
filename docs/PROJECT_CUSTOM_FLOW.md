# Custom-part preview flow

Status: Batch 2 custom-part preview implemented and reconciled with the integrated foundation/current production UI. This head awaits targeted Claude review; release state and the dependency sequence are maintained in STATUS.md. Production continues using the legacy engine. This batch enables no production flag, deletes no legacy code and removes no existing project data. Inventory boxes remain unchecked until accepted replacement/cutover.

## API and data

`project-workspace-api.js` dispatches the owner-only `/api/project-engine/projects` API. The enclosing handler enforces the preview flag and same-origin writes. A project-wide revision serializes all metadata commands; the route, target, owner, data and loaded revision are fingerprinted. Replay happens before number allocation and domain checks. An unchanged save creates no receipt or History event. Different content under an admitted operation ID returns 409.

Migration 2 adds steps, records, files and explicit file links, plus case-insensitive reserved-number uniqueness. Migration 1 remains unchanged. Record configuration and step foreign keys include item identity, preventing evidence from capturing another item's configuration even within the same project. Step reordering uses one JSON parameter and checks complete active membership in admission, rather than exceeding D1's 100 bound-parameter limit.

`project-workspace-commands.js` owns custom creation/edit/revision, independent duplication, steps, records and removal/restoration. Stable IDs and numbers remain reserved after removal. Original location text is captured at removal/retirement and survives root renames. Ordinary changed saves retain/deduplicate internal configurations without adding History entries; explicit revisions add one event referencing before/after configurations. Records capture the current configuration on the server, including ordinary edits, and freeze their step title/body. Editing record text retains the configuration that was actually tested.

`project-history.js` returns flat, project-scoped History with item/type/text filters, a stable `(created_at,id)` cursor and read-only configuration details. The creation entry reflects the current record text/type; each changed edit also has a separate immutable Record edited event under Changes. Its saved before/after values and tested configuration are never read from the mutable record.

## Immutable files

`project-engine-files.js` uses prepare → bounded immutable upload → admission. Each upload has a new R2 key and create-only condition; its SHA-256 is calculated by the server. The maximum file size is 20 MB. A repeat upload must match the operation, token, owner and actual bytes. Admission publishes the ready metadata, current link, configuration and file-change event in one D1 transaction. Previous configurations retain links to previous bytes.

Interrupted/stale uploads can leave unreachable staging objects. They cannot create an active broken link, overwrite an earlier object or trigger a deletion. Purge remains out of scope. Downloads are owner-only, private/no-store and attachments by default; only the explicit safe raster image types can be served inline.

## Backup and restore

`project-backup.js` streams versioned NDJSON (`.bsproject`): a consistent D1 manifest, bounded file chunks and a required completion marker. Every ready file, including supporting attachments and retained historical bytes, is exported and verified against its saved hash. Prepared metadata is retained without a fabricated file. All engineering tables are included.

The normal UI restores a separate named project copy through POST /projects/:newProjectId/import-copy?name=…. It assigns a new project ID/owner/revision and re-scopes every relational row to that project, retaining the child/specification/step/record/configuration/event/file/link IDs within their project scope. Historical JSON snapshots, fingerprints, original project/build context and file identities are not rewritten. This makes a source and its recovered copy coexist in the same database. The existing import route still preserves original project identity for an absent independent target. Both routes refuse to replace any existing project. Every file is independently written, read back and hash-verified under a target-project/operation restore namespace before one guarded D1 metadata transaction publishes the restored project. Invalid/truncated bytes cannot admit a project. A failed attempt may leave unlinked staging bytes. The source backup is never deleted.

Owner identity is assigned to the authenticated restoring owner, the aggregate revision is newly issued, and old command receipts are not imported: receipts and tokens represent a previous installation's concurrency state, not engineering history. Restore creates one new import receipt and supports exact retries. Original-identity restore still requires an absent target. Copy restore does not require deleting or moving the source. A named copy's target ID and operation ID remain stable on UI retries; changing the requested name starts a separate attempt. Keys include target project and operation, so separate recovered projects do not share restored objects, even if callers reuse an operation ID.

This first preview accepts at most 10,000 metadata rows, a 4 MB manifest and a 256 MB serialized backup, with each file at most 20 MB. Unsupported metadata size stops export before a partial download is presented as success. Completion/hash validation is mandatory on restore. These bounds must be reviewed against actual project sizes before cutover.

## Acceptance and release gate

Local SQL tests cover initial creation/numbering, ordinary edits/no-op, evidence at 3 mm followed by a 5 mm revision, replay and stale rejection, removed/retired work and original paths, independent duplication, 120-step reordering, equal-time History pagination, cross-item foreign-key rollback, immutable replacement and independent byte-verified restore. The original seven-check foundation proof still passes locally. These tests are not a substitute for Cloudflare D1/R2 acceptance.

Verified: 264 Node tests and 78 browser workflows pass at source `c2f1134e1d77076aa6006da8f0c8e1b042542104`; the browser flow covers 1440/390 px, stale-draft review, attachment-only records, cancellation and paginated History selection/scroll. On actual Cloudflare D1/R2, creation, 3 → 5 mm revision with original test evidence, immutable drawing replacement/download, step retirement/restoration, part removal/undo and export succeeded. The self-contained backup restored into the owner-created empty D1 target `d761ae08-64f2-4130-8cfa-f596e8e89b80`. IDs, all engineering metadata and both file hashes/bytes matched; tokens reset and restored objects use different R2 keys. After returning to the original binding, its exported backup was byte-for-byte unchanged. Exact sources/builds and comparison results are in `PROJECT_CUSTOM_FLOW_PROOF.json`; the primitive proof remains in `PROJECT_ENGINE_D1_PROOF.json`.

These evidence levels are distinct: the full edge-case matrix runs through real SQL/Worker handlers and browser CI; the production-platform manual walkthrough checks the observed Cloudflare flows above. At that historical evidence point, the next gates were owner walkthrough/review before Batch 3, independent code review and later feature-complete production cutover. Batch 3 now exists as queued PR #66; the current integration still needs its own targeted review and the eventual feature-complete cutover gates. No claim is made that this first custom-part slice replaces every retained legacy feature.

## Rollback

Before preview deployment, revert this batch's code. After migration 2 has run, leave its tables and bytes intact: roll back code to the preceding proven preview, or disable the preview flag and redeploy. Never edit an applied migration, drop tables, reseed, delete R2 or point preview at production. If a correction needs schema changes after deployment, append the next unused migration after all versions already applied to that database. Production remains on the authenticated main branch; this preview is not a cutover.

Cloudflare limits and conditional-write references checked November 22, 2026: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/r2/api/workers/workers-api-reference/ . A D1 batch counts as one invocation query, while each statement retains the 100-parameter limit. No new dependency is required.

## Preview screens

`project.html` is gated along with its pretty-URL aliases. It uses the shared header/kit and small page-layout CSS; it imports no legacy controller. `project-workspace.js`, `project-editors.js`, `project-history-view.js` and `project-client.js` separate navigation, editors, History presentation and transport. Their explicit page initialization adds no new global API.

The screen covers custom details/specification types, optional revision comparison, work steps/records, engineering/supporting files, removal/undo/restoration and flat History/Removed panes. Sections start collapsed; tests' saved configuration is opened when viewing their evidence. Tree indicators lead text. Pane widths persist through the existing shared resizer. History remembers filters, selected entry and list scroll in the current page session, and phones use Back to history. No Workshop/product or nested-assembly UI is implied by this slice.

Transport failures retain the same command body/operation and loaded revision; edited content gets a new operation. 409 retains the open draft and offers an explicit newer-version review before using its token. Uploaded supporting files advance only the editor's own token. Cancel does not publish a record or revision. Server-generated current configurations remain authoritative.

The conservative CSS literal scanner now excludes only the shared section's `countLabel` property, which is count text rather than a class producer. This fixes a false positive for the noun “steps”; an actual `className` reintroduction remains blocked by a regression test. No retired CSS or specificity exception is added.

Owner refinement: custom in-house parts require neither Manufacturer nor MPN. The model already treats them as optional; the custom editor now groups them in a collapsed optional section. Missing values stay absent, and existing values are retained. The project part number remains separate.

Owner refinement: in-house parts skip Where to buy / supplier-entry screens. This custom-part preview has no purchasing stage; later purchased-part flows may expose procurement fields. Hiding inapplicable fields must preserve any existing supplier data and historical evidence. The legacy production editor is unchanged until the reviewed cutover.

Owner refinement: Add specification uses the shared content-width 44 px button, with hover help and a keyboard/touch-accessible explanation using the same wording in `project-help.js`. Later Add supplier must use the same button helper and sizing; there is no supplier UI in the in-house flow. History headers count all matching events even while showing only the latest five rows.

## Integration with the current production baseline

The engine attachment module was moved byte-for-byte from functions/api/project-files.js to functions/api/project-engine-files.js because main already uses the former path for the live project-wide file/ZIP API. project-workspace-api.js and project-backup.js import the engine module; worker.js keeps importing the legacy handler from project-files.js. Neither file ownership model is combined with the other or silently removed. Full browser validation covers both existing project files and the engine upload/history/export/restore flow.

The new-project form already shows editable Number prefix and Minimum digits. Its browser flow now explicitly chooses BB / 3 and verifies BB100 rather than relying on the NR / 4 default. This changes no numbering default, stored project or applied migration. The short_name/project-owned History follow-ups remain queued as described in STATUS.md and the History plan; this integration does not claim they are implemented.

The earlier Cloudflare proof remains historical evidence of its pinned runtime. The current main-alignment head requires targeted Claude review. A fresh control-plane acceptance is pending the later runner and owner-provisioned secret; production activation is not part of this PR.

Integration validation: 300 Node/source/CSS checks and all 117 browser workflows pass locally with main #52/#70 present. Both the old file/ZIP flows and the gated engine upload/history/recovery flows pass. The retired project-copy class was renamed to project-instruction-text at its engine JS/CSS owner; no retirement list, legacy stylesheet budget or specificity guard was relaxed. GitHub checks and targeted Claude review belong to the current published head, not the historical proof commit above.

## Configuration correction after targeted review

New design identity consists of normalized saved part details and its exact engineering file, not occurrence/build or project-label fields. New snapshots use format 2. Build context is frozen with each record in its creation event's record_context; revision/file events keep before/after build_context. The server derives it under the same project guard, never from editable record input. History renders it separately. Replay ordering is unchanged.

Format-1 combined snapshots remain byte-for-byte unchanged. They are readable/exportable/restorable, with legacy context explicitly identified; new captures establish format-2 identity rather than rewriting historical fingerprints. A build-only explicit checkpoint can reference the same design before and after without inserting duplicate configurations.

Record edits commit an immutable Record edited event in the same guarded transaction as text/file-link changes. Its before/after values include type/title/prompts/event date/attachment IDs; actor/time, stable record and creation-event links, tested design and original build context are retained. Audit event file links preserve removed and replaced attachments. The edited_record_id key avoids duplicate creation/Knowledge mappings. Changes/search/detail views use saved audit values, with Before edit/After edit panels and no edit control. Exact retries, no-ops, stale saves, failed-audit rollback, later edits and mixed-format recovery are covered by regression checks.

Recovery as a separate named project copy is now implemented in the gated API/UI. Regression coverage checks same-database coexistence, complete scoped metadata, unchanged source export/bytes, original evidence context, independent storage keys, exact replay, existing-target/name/corruption rejection and owner isolation. The original independent-target import/proof route remains available. Current changes still need exact-head CI and review. Representative large Cloudflare restore limits remain unmeasured; no new platform proof or production recovery readiness is claimed.

## Numbered part checkpoints and tree Archive (#65)

Append-only migration 3 adds revision_level, starting at 1. Create a Revision captures the currently saved part, retains that level on its immutable copy and advances the working level once. Save as revision captures the previous saved scope, then commits edited details as the next level in the same guarded transaction. Ordinary Save retains the level. A checkpoint number is not part of design configuration identity; unchanged-design before/after references may be equal.

Full part snapshot format 3 includes the saved part/build/level, steps, records, record creation/edit events, attachment ownership, tested configurations and exact retained file metadata. Captured record context remains the original context of the test, separate from the build state at the part checkpoint. Record events exclude recursive complete part-revision payloads. Earlier full snapshots and configuration formats remain readable; missing old ownership/context is not fabricated. Copy recovery keeps captured JSON exact while relational file IDs resolve independent target storage keys.

Tree Archive uses right-click, keyboard or the touch Actions button. It preserves a full saved copy in the project's History → Archive, removes active membership and leaves the part level unchanged. Restore keeps item/occurrence IDs, number and level. Issued numbers cannot be renamed/reused; case and zero-padding aliases reserve the same number. New projects default to three digits; existing numbering settings remain exact.

Revisions stays at the part bottom with one standard chevron per saved copy, its date and What changed, a saved count and working-level metadata. The duplicate table/view control is removed. Pagination and per-trigger prompts prevent duplicate surfaces. The shared explanation/photo dialog has an engine upload callback; its legacy default path remains unchanged. Stale explanations/photos/drafts require explicit newer-version review. All source changes require exact-head CI/review, separate from retained historical live proofs.

A record also freezes its tested part revision level in record_context.part, independently of design identity. Revision/file before/after context retains the applicable level. A shared pure reader preserves known counters from older combined snapshots and omits unknown historical levels; it never guesses from the current working counter.
