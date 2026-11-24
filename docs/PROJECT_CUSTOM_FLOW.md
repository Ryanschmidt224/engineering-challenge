# Custom-part preview flow

Status: Batch 2 custom-part preview implemented and checked after the actual Cloudflare D1 foundation gate passed. Owner walkthrough/review is the next gate before Batch 3. Production continues using the legacy engine. No production flag is enabled, legacy code is deleted, or existing project data is removed by this batch. Feature inventory boxes stay unchecked until the owner preview and later cutover.

## API and data

`project-workspace-api.js` dispatches the owner-only `/api/project-engine/projects` API. The enclosing handler enforces the preview flag and same-origin writes. A project-wide revision serializes all metadata commands; the route, target, owner, data and loaded revision are fingerprinted. Replay happens before number allocation and domain checks. An unchanged save creates no receipt or History event. Different content under an admitted operation ID returns 409.

Migration 2 adds steps, records, files and explicit file links, plus case-insensitive reserved-number uniqueness. Migration 1 remains unchanged. Record configuration and step foreign keys include item identity, preventing evidence from capturing another item's configuration even within the same project. Step reordering uses one JSON parameter and checks complete active membership in admission, rather than exceeding D1's 100 bound-parameter limit.

`project-workspace-commands.js` owns custom creation/edit/revision, independent duplication, steps, records and archiving/restoration. Stable IDs and numbers remain reserved after archive, including differently padded spellings; issued numbers cannot be edited. New projects default to three digits. Original location text is captured at removal/retirement and survives root renames. Ordinary changed saves retain/deduplicate internal configurations without adding History entries; explicit revisions add one event referencing before/after configurations. Records capture the current configuration on the server, including ordinary edits, and freeze their step title/body. Editing record text retains the configuration that was actually tested.

`project-history.js` returns flat, project-scoped History with item/type/text filters, a stable `(created_at,id)` cursor and read-only configuration details. Edited record text/type is reflected in the list without fabricating a second event or rewriting its tested configuration.

## Immutable files

`project-engine-files.js` uses prepare → bounded immutable upload → admission. Each upload has a new R2 key and create-only condition; its SHA-256 is calculated by the server. The maximum file size is 20 MB. A repeat upload must match the operation, token, owner and actual bytes. Admission publishes the ready metadata, current link, configuration and file-change event in one D1 transaction. Previous configurations retain links to previous bytes.

Interrupted/stale uploads can leave unreachable staging objects. They cannot create an active broken link, overwrite an earlier object or trigger a deletion. Purge remains out of scope. Downloads are owner-only, private/no-store and attachments by default; only the explicit safe raster image types can be served inline.

## Backup and restore

`project-backup.js` streams versioned NDJSON (`.bsproject`): a consistent D1 manifest, bounded file chunks and a required completion marker. Every ready file, including supporting attachments and retained historical bytes, is exported and verified against its saved hash. Prepared metadata is retained without a fabricated file. All engineering tables are included.

Restore preserves project, item, occurrence, specification, step, record, configuration, event, file and link IDs. It refuses to replace an existing project. Every file is independently written, read back and byte-hash verified under a restore namespace before one guarded D1 metadata transaction publishes the restored project. Invalid/truncated bytes cannot admit a project. A failed attempt may leave unlinked staging bytes. The source backup is never deleted.

Owner identity is assigned to the authenticated restoring owner, the aggregate revision is newly issued, and old command receipts are not imported: receipts and tokens represent a previous installation's concurrency state, not engineering history. Restore creates one new import receipt and supports exact retries. The isolated target must therefore have a separate empty database if the original project remains in the source.

This first preview accepts at most 10,000 metadata rows, a 4 MB manifest and a 256 MB serialized backup, with each file at most 20 MB. Unsupported metadata size stops export before a partial download is presented as success. Completion/hash validation is mandatory on restore. These bounds must be reviewed against actual project sizes before cutover.

## Acceptance and release gate

Local SQL tests cover initial creation/numbering, ordinary edits/no-op, evidence at 3 mm followed by a 5 mm revision, replay and stale rejection, removed/retired work and original paths, independent duplication, 120-step reordering, equal-time History pagination, cross-item foreign-key rollback, immutable replacement and independent byte-verified restore. The original seven-check foundation proof still passes locally. These tests are not a substitute for Cloudflare D1/R2 acceptance.

Verified: 264 Node tests and 78 browser workflows pass at source `c2f1134e1d77076aa6006da8f0c8e1b042542104`; the browser flow covers 1440/390 px, stale-draft review, attachment-only records, cancellation and paginated History selection/scroll. On actual Cloudflare D1/R2, creation, 3 → 5 mm revision with original test evidence, immutable drawing replacement/download, step retirement/restoration, part removal/undo and export succeeded. The self-contained backup restored into the owner-created empty D1 target `d761ae08-64f2-4130-8cfa-f596e8e89b80`. IDs, all engineering metadata and both file hashes/bytes matched; tokens reset and restored objects use different R2 keys. After returning to the original binding, its exported backup was byte-for-byte unchanged. Exact sources/builds and comparison results are in `proofs/PROJECT_CUSTOM_FLOW_PROOF.json`; the primitive proof remains in `proofs/PROJECT_ENGINE_D1_PROOF.json`.

These evidence levels are distinct: the full edge-case matrix runs through real SQL/Worker handlers and browser CI; the production-platform manual walkthrough checks the observed Cloudflare flows above. Remaining: owner walkthrough/review before Batch 3, independent code review and the later feature-complete production cutover. No claim is made that this first custom-part slice replaces every retained legacy feature.

## Rollback

Before preview deployment, revert this batch's code. After migration 2 has run, leave its tables and bytes intact: roll back code to the preceding proven preview, or disable the preview flag and redeploy. Never edit an applied migration, drop tables, reseed, delete R2 or point preview at production. If a correction needs schema changes after deployment, append migration 3. Production remains on the authenticated main branch; this preview is not a cutover.

Cloudflare limits and conditional-write references checked November 22, 2026: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/r2/api/workers/workers-api-reference/ . A D1 batch counts as one invocation query, while each statement retains the 100-parameter limit. No new dependency is required.

## Preview screens

`project.html` is gated along with its pretty-URL aliases. It uses the shared header/kit and small page-layout CSS; it imports no legacy controller. `project-workspace.js`, `project-editors.js`, `project-history-view.js` and `project-client.js` separate navigation, editors, History presentation and transport. Their explicit page initialization adds no new global API.

The screen covers custom details/specification types, numbered full-part revisions, work steps/records, engineering/supporting files, tree archiving/restoration and History/Archive panes. Sections start collapsed; tests' saved configuration is opened when viewing their evidence. Tree indicators lead text. Pane widths persist through the existing shared resizer. History remembers filters, selected entry and list scroll in the current page session, and phones use Back to history. No Workshop/product or nested-assembly UI is implied by this slice.

Transport failures retain the same command body/operation and loaded revision; edited content gets a new operation. 409 retains the open draft and offers an explicit newer-version review before using its token. Uploaded supporting files advance only the editor's own token. Cancel does not publish a record or revision. Server-generated current configurations remain authoritative.

The conservative CSS literal scanner now excludes only the shared section's `countLabel` property, which is count text rather than a class producer. This fixes a false positive for the noun “steps”; an actual `className` reintroduction remains blocked by a regression test. No retired CSS or specificity exception is added.

Owner refinement: custom in-house parts require neither Manufacturer nor MPN. The model already treats them as optional; the custom editor now groups them in a collapsed optional section. Missing values stay absent, and existing values are retained. The project part number remains separate.

Owner refinement: in-house parts skip Where to buy / supplier-entry screens. This custom-part preview has no purchasing stage; later purchased-part flows may expose procurement fields. Hiding inapplicable fields must preserve any existing supplier data and historical evidence. The legacy production editor is unchanged until the reviewed cutover.

Owner refinement: Add specification uses the shared content-width 44 px button, with hover help and a keyboard/touch-accessible explanation using the same wording in `project-help.js`. Later Add supplier must use the same button helper and sizing; there is no supplier UI in the in-house flow. History headers count all matching events even while showing only the latest five rows.

## Current revision and archive refinement

The preview now follows the owner’s live behavior. Revisions sit at the part-page bottom in a shared table. Create a Revision freezes the current saved context and advances the working part once; it opens only the What changed / Why did you change it / Notes / named-photo prompt. The details editor has separate Save and Save as revision buttons with keyed tooltips. Save changes the part at the same level; Save as revision freezes the previous saved state and commits edits at the next level. New numbering starts at Revision 1. Earlier unnumbered events remain Earlier copy.

Append-only migration 3 adds the item’s revision_level; migrations 1 and 2 remain unchanged. The counter, new configuration, full snapshot event and operation receipt share the existing guarded D1 batch. project-part-snapshot.js captures the old item/build, steps, records, their immutable configurations and relevant immutable files. Snapshot metadata is bounded to 500 KB. Explanation text is bounded to 5,000 characters per field, with at most 12 project-owned named images. Captions are at most 120 characters. A failed or stale command cannot advance the counter or publish an event. Request receipts remain available in the page session after a successful save so a failed refresh can retry the same command without a duplicate revision; replay cannot roll a newer client token backward.

The feature tree exposes Archive part by right-click, Shift+F10/context key or a touch Actions button. The old Remove from build dropdown is removed. Archiving captures the complete saved context and optional explanation/photos, removes active membership and creates no revision. The project root’s History → Archive folder opens the preserved parts and retired steps. Back to build returns to the parent project. Restore retains identity, number and revision level. This first slice still has root-level custom parts only; nested assemblies and Workshop integration belong to Batch 3.

project-part-history.js and project-information.js separate the numbered table, prompts and read-only snapshots from navigation/editors. context-menu.js is a shared keyboard/touch menu using the existing component styles. The standard photo choose/paste/drop surface is reused, with project-engine upload logic injected into history-entry-dialog.js. Its shared gallery/upload CSS was moved out of the legacy files at its source; uploaded bytes use engine file IDs, never legacy recipe-file routes. The reusable photo helper’s buttons now use BSUI. No application controller is imported into the preview page.

The main branch’s authenticated legacy features were synchronized before this refinement. The similarly named APIs stay separate: project-files.js remains the live project file index, while project-engine-files.js owns immutable preview files. The duplicate previews.vars key was consolidated so the engine flag and existing AI flag remain in one preview block; production still has no NEW_PROJECT_ENGINE flag. No production table write, engine switch, data purge or legacy feature retirement is authorized by this refinement.

## Repeatable recovery acceptance

The existing gated project-engine-proof page now also offers an explicit custom-part recovery proof. Its source action uses only normal owner APIs to create one clearly named synthetic project, two custom parts, steps/records, numbered revisions, both drawing versions and one named photo. It checks standard Save, revision retries, immutable old context, Archive without an iteration, reserved padded aliases and stable restore. No source project or file is deleted.

The separate recovery action consumes the self-contained backup through the normal import API. It compares every engineering table and stable identity, revision levels, full snapshot and archive metadata, actual file sizes/hashes and independent restored storage keys. A new project token is required; owner identity follows the authenticated restoring owner. An existing project is never replaced except that an exact committed import operation can replay its result. Switching back to the source and pressing Verify source is unchanged compares the original export byte-for-byte.

Run these checks only after verifying the actual Cloudflare preview bindings. Source D1 is 3314f42f-7c04-4798-99dc-b5b97c4fb82f; the independent recovery D1 is d761ae08-64f2-4130-8cfa-f596e8e89b80. Both use the isolated preview R2 bucket. Other existing fixtures in either database remain intact; the target project ID must be absent on the first import. The old proofs/PROJECT_CUSTOM_FLOW_PROOF.json remains pinned to its earlier runtime. Current owner-run Cloudflare acceptance is recorded in proofs/PROJECT_HISTORY_SOURCE_PROOF.json and proofs/PROJECT_HISTORY_RECOVERY_PROOF.json: source workflow, independent-target restore and the final byte-for-byte source-integrity check all passed on November 23, 2026. The exact source commit is 5dea81ecbf6429fb714847052602a67ca024fb9a (build aae7a97b-e25a-4c8b-8b50-107039eaddb1); the matching restore runtime is ddf3eeb886889c51c7ea206dced794e2b1407524 (build 9971a730-d188-4ba6-851f-7dd3435023a7). All table counts, identities and three file hashes match; both reports and the final source check share backup SHA-256 2815b36f8a932cead97ac7077b3cb01f26fc8725f83b91ef795818d3539e23ca. Owner screenshots verified both previews’ binding target names; database UUIDs are pinned in their deployment configurations. The implementation passed 297 Node/source checks and 107 browser workflows. Later documentation-only evidence commits do not change the tested runtime. Local/CI evidence remains distinct from these real Cloudflare checks, and this platform acceptance does not imply complete retained-feature parity or production cutover.

After numbered writes, rollback must retain the compatible migration-3 reader/exporter and immutable events/files. Do not deploy an older-only exporter that omits revision levels. Do not drop tables, edit applied migrations, delete accounts, reseed storage or overwrite legacy projects. Feature-inventory acceptance and the production cutover remain separate gates after the owner’s preview walkthrough and complete retained-feature parity.


## Assembly and Workshop extension

The owner authorized the next isolated batch after the numbered custom-part recovery checks passed. `PROJECT_ASSEMBLIES_WORKSHOP.md` records the additive hierarchy/selection model, grouped archive behavior, new UI flow, limits and new platform acceptance boundary. This extension retains the earlier custom-part runtime evidence at its pinned source rather than relabeling old reports as a new deployment proof.
