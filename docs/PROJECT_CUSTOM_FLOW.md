# Custom-part preview flow

Status: Batch 2 implementation in progress after the actual Cloudflare D1 foundation gate passed. Production continues using the legacy engine. No production flag is enabled, legacy code is deleted, or existing project data is removed by this batch. Feature inventory boxes stay unchecked until the owner preview and later cutover.

## API and data

`project-workspace-api.js` dispatches the owner-only `/api/project-engine/projects` API. The enclosing handler enforces the preview flag and same-origin writes. A project-wide revision serializes all metadata commands; the route, target, owner, data and loaded revision are fingerprinted. Replay happens before number allocation and domain checks. An unchanged save creates no receipt or History event. Different content under an admitted operation ID returns 409.

Migration 2 adds steps, records, files and explicit file links, plus case-insensitive reserved-number uniqueness. Migration 1 remains unchanged. Record configuration and step foreign keys include item identity, preventing evidence from capturing another item's configuration even within the same project. Step reordering uses one JSON parameter and checks complete active membership in admission, rather than exceeding D1's 100 bound-parameter limit.

`project-workspace-commands.js` owns custom creation/edit/revision, independent duplication, steps, records and removal/restoration. Stable IDs and numbers remain reserved after removal. Original location text is captured at removal/retirement and survives root renames. Ordinary changed saves retain/deduplicate internal configurations without adding History entries; explicit revisions add one event referencing before/after configurations. Records capture the current configuration on the server, including ordinary edits, and freeze their step title/body. Editing record text retains the configuration that was actually tested.

`project-history.js` returns flat, project-scoped History with item/type/text filters, a stable `(created_at,id)` cursor and read-only configuration details. Edited record text/type is reflected in the list without fabricating a second event or rewriting its tested configuration.

## Immutable files

`project-files.js` uses prepare → bounded immutable upload → admission. Each upload has a new R2 key and create-only condition; its SHA-256 is calculated by the server. The maximum file size is 20 MB. A repeat upload must match the operation, token, owner and actual bytes. Admission publishes the ready metadata, current link, configuration and file-change event in one D1 transaction. Previous configurations retain links to previous bytes.

Interrupted/stale uploads can leave unreachable staging objects. They cannot create an active broken link, overwrite an earlier object or trigger a deletion. Purge remains out of scope. Downloads are owner-only, private/no-store and attachments by default; only the explicit safe raster image types can be served inline.

## Backup and restore

`project-backup.js` streams versioned NDJSON (`.bsproject`): a consistent D1 manifest, bounded file chunks and a required completion marker. Every ready file, including supporting attachments and retained historical bytes, is exported and verified against its saved hash. Prepared metadata is retained without a fabricated file. All engineering tables are included.

Restore preserves project, item, occurrence, specification, step, record, configuration, event, file and link IDs. It refuses to replace an existing project. Every file is independently written and verified under a restore namespace before one guarded D1 metadata transaction publishes the restored project. Invalid/truncated bytes cannot admit a project. A failed attempt may leave unlinked staging bytes. The source backup is never deleted.

Owner identity is assigned to the authenticated restoring owner, the aggregate revision is newly issued, and old command receipts are not imported: receipts and tokens represent a previous installation's concurrency state, not engineering history. Restore creates one new import receipt and supports exact retries. The isolated target must therefore have a separate empty database if the original project remains in the source.

This first preview accepts at most 10,000 metadata rows, a 4 MB manifest and a 256 MB serialized backup, with each file at most 20 MB. Unsupported metadata size stops export before a partial download is presented as success. Completion/hash validation is mandatory on restore. These bounds must be reviewed against actual project sizes before cutover.

## Acceptance and release gate

Local SQL tests cover initial creation/numbering, ordinary edits/no-op, evidence at 3 mm followed by a 5 mm revision, replay and stale rejection, removed/retired work and original paths, independent duplication, 120-step reordering, equal-time History pagination, cross-item foreign-key rollback, immutable replacement and independent byte-verified restore. The original seven-check foundation proof still passes locally. These tests are not a substitute for Cloudflare D1/R2 acceptance.

Remaining gates: real browser workflow checks at 1440/390 px; actual Cloudflare custom-part/file acceptance; export and restore into an empty isolated Cloudflare target; owner walkthrough F1–F11 before Batch 3. The exact foundation proof report remains in `PROJECT_ENGINE_D1_PROOF.json`. This document must be updated with actual evidence before declaring this batch complete.

## Rollback

Before preview deployment, revert this batch's code. After migration 2 has run, leave its tables and bytes intact: roll back code to the preceding proven preview, or disable the preview flag and redeploy. Never edit an applied migration, drop tables, reseed, delete R2 or point preview at production. If a correction needs schema changes after deployment, append migration 3. Production remains on the authenticated main branch; this preview is not a cutover.

Cloudflare limits and conditional-write references checked November 22, 2026: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/r2/api/workers/workers-api-reference/ . A D1 batch counts as one invocation query, while each statement retains the 100-parameter limit. No new dependency is required.

## Preview screens

`project.html` is gated along with its pretty-URL aliases. It uses the shared header/kit and small page-layout CSS; it imports no legacy controller. `project-workspace.js`, `project-editors.js`, `project-history-view.js` and `project-client.js` separate navigation, editors, History presentation and transport. Their explicit page initialization adds no new global API.

The screen covers custom details/specification types, optional revision comparison, work steps/records, engineering/supporting files, removal/undo/restoration and flat History/Removed panes. Sections start collapsed; tests' saved configuration is opened when viewing their evidence. Tree indicators lead text. Pane widths persist through the existing shared resizer. History remembers filters, selected entry and list scroll in the current page session, and phones use Back to history. No Workshop/product or nested-assembly UI is implied by this slice.

Transport failures retain the same command body/operation and loaded revision; edited content gets a new operation. 409 retains the open draft and offers an explicit newer-version review before using its token. Uploaded supporting files advance only the editor's own token. Cancel does not publish a record or revision. Server-generated current configurations remain authoritative.

The conservative CSS literal scanner now excludes only the shared section's `countLabel` property, which is count text rather than a class producer. This fixes a false positive for the noun “steps”; an actual `className` reintroduction remains blocked by a regression test. No retired CSS or specificity exception is added.

Owner refinement: custom in-house parts require neither Manufacturer nor MPN. The model already treats them as optional; the custom editor now groups them in a collapsed optional section. Missing values stay absent, and existing values are retained. The project part number remains separate.

Owner refinement: in-house parts skip Where to buy / supplier-entry screens. This custom-part preview has no purchasing stage; later purchased-part flows may expose procurement fields. Hiding inapplicable fields must preserve any existing supplier data and historical evidence. The legacy production editor is unchanged until the reviewed cutover.

Owner refinement: Add specification uses the shared content-width 44 px button, with hover help and a keyboard/touch-accessible explanation using the same wording in `project-help.js`. Later Add supplier must use the same button helper and sizing; there is no supplier UI in the in-house flow. History headers count all matching events even while showing only the latest five rows.
