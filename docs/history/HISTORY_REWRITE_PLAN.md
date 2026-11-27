> Historical checkpoint. See [current status](../STATUS.md) and the [combined review plan](../WHOLE-SITE-REVIEW-2026-11-27.md). Earlier rollout gates and retired feature instructions do not apply.

# BuildingSchmidt History Rewrite Plan

## Approved decisions — November 22, 2026

The owner approved the direction and the accompanying [Batch 0 decisions and custom-part specification](BATCH0_CUSTOM_PART_SPEC.md). That document controls implementation where this original plan differs.

- Keep Cloudflare hosting. Structured projects and History move to D1; immutable bytes stay in R2.
- Owner refinement, November 23: **Create a Revision** saves the current saved part and its historical context from a separate Revisions section at the part-page bottom. Its metadata prompt records What changed, Why did you change it, Notes and optional named photos. It records the date automatically, preserves the old revision level on the saved copy, advances the working part once, and opens no part-details editor. The latest display preference is one chevron entry per saved copy, with revision label, date and What changed in its header; there is no duplicate table. The group separately shows the working revision and counts saved copies only. The details editor offers Save as revision (snapshot the previous saved state and save edits as the next revision) and Save (overwrite at the same revision level), with tooltips. Archiving is a tree context action that removes the selected subtree from the active build and preserves it under the parent’s History → Archive without creating a part iteration. These owner-refined actions supersede the original editor interaction below; D1 preview alignment is still pending. Product selection remains a separate Batch 3 action.
- Duplication creates independent items; sharing requires an explicit placement decision.
- Independent cleanup may deploy now. Batches 1–2 run only on isolated preview storage; the production engine flag stays absent and its routes return 404. No production new-table writes.
- Prove the guarded operation on **real preview D1 before building dependent commands**. SQLite fixtures alone do not satisfy that gate.
- Owner early-live refinement: legacy projects/pages remain in place, read-only; new work goes to the engine after separate switch-over approval. Do not delete or import anything. Moving individual legacy projects is optional later work, not a cutover prerequisite. This overrides the older Batch 6/7 disposition and full-parity gates below.
- Do not delete project data before cutover. A later reviewed deletion is separate from code deployment. Preserve Workshop, Knowledge and accounts. Purge is deferred.
- Ordinary edit / no-op / retry / configuration accuracy / file retention / remove / restore behavior must satisfy F1–F11 in the companion spec.

**Foundation evidence:** the historical Batch 1 Cloudflare D1 verification and replay on November 22, 2026 (Arizona) are retained in `PROJECT_ENGINE_D1_PROOF.json`. They prove the pinned runtime, not every later integration head. Targeted review gates foundation integration. The later review approved integrating this unchanged command logic with the production engine disabled; fresh deployed-version/control-plane verification remains required before claiming new preview acceptance or activation. Production activation and data cutover are separate gates. The earlier *History Redesign* and *Status and History Rewrite* proposals are superseded by this plan and the companion spec; Git history and the original review artifacts retain their rationale. They are not independent implementation requirements.

## Current implementation order and plan refinements

The owner has supplied a broader UI handoff and alternative-parts spec, plus subsequent screenshots and revision/file requirements. Later explicit requests override stale handoff wording; these refinements control the historical detailed plan below. `STATUS.md` is the one maintained release/status document; this plan owns behavior, sequence and acceptance rather than duplicating deployment state.

1. **Completed production repair:** PR #67 preserves parts reads on failed/incomplete photo metadata checks and avoids image-body existence reads. PR #68 supplies Details/List/Tiles and searchable, filtered Calculators. Both were reviewed, passed combined checks, and were explicitly approved for merge and deployment. The production engine flag remains absent.
2. **Shared presentation baseline:** preserve the full-width gutter, title-only Workshop/Knowledge/Calculator headers, help tooltips with visible errors/status, compact section actions, blank unselected detail panels, the standard Alternatives row and Select Alternative label, shared archived-entry headers, and one dated revision disclosure per saved copy. Keep presentation work independent of engine/schema changes. Existing user data and revision/archive behavior stay intact; current release state is in `STATUS.md`.
3. **Integrate the reviewed foundation:** targeted Claude reviews and guarded merges of #52 → #53 → #65 → #66 remain required. Retain the source/independent-target recovery proof and actual-binding preflight. Rebase each integration against current main and carry forward the owner's latest single-disclosure revision display; do not revive a duplicate table or fold Revisions into History.
4. **Work Instructions batch:** complete the retained instruction/record workflows, then apply the shared revision mechanism to individual instructions and header/group subtrees. Snapshot the explicit scope, order, attachments and records. Its revision sequence is independent of the part. The same batch must preserve these versions through export/restore; it cannot defer recoverability.
5. **Reduced pre-switch scope, in order:** 4b History screens; 5a screen-only project directory search/sort/views, Parts Management, summary BOM/Tools and readable HTML (brief's 5a rows); nightly engine-project .bsproject backups under automatic-backups/ through the existing cron/export; project photos/part pictures through the brief's engine_item_files table with only project_photo, part_picture and photo roles and the existing markup/viewer. No restore/recovery changes. Each is one latest-main PR, merged before the next starts; backup and photo PRs require Claude review.
6. **After switch-over:** remaining Batch 5 groups, including identity/alternatives, purchasing, notes/milestones and engineering files/code, become separate small PRs only in the order requested by the owner. Preserve all longer existing names and historical payloads. Do not add new tree-name uses. Keep Calculator topics; do not port engine Recent changes or project tags. Independent CAD/file revision labels stay deferred.
7. **Cutover gate:** after the reduced scope merges, present one owner list covering the actual Cloudflare timing/acceptance run, the accepted 100-placement Archive limit, and server-enforced legacy read-only behavior with confirmation nothing was deleted. The owner has explicitly approved activation and accepted the Archive limit; do not ask again. Activate only after required review and platform checks, then explicitly tell the owner when production is ready for data they want to keep. No import, renumbering, automatic milestones, shared-Workshop mutation or historical-file deletion.

There are no unresolved product decisions needed for the shared UI batch. The engine work has external technical-review gates rather than an assumed authorization to skip them. Existing names and immutable evidence win over mechanical application of stale source line numbers or old form requirements. Technical matching remains deliberately conservative: a numeric comparison checks only an entered condition, never engineering equivalence.

### Recovery/cleanup scope freeze

Recovery and cleanup design is frozen at schema 9. Further changes are bug fixes only, or changes driven by a real-D1 measurement. Any future orphan deletion is a single owner-pressed action after cutover that reuses the existing inventory and executors; no new tables, triggers or journals. No scheduled orphan sweep. The retained implementation descriptions below explain existing behavior, not authorization to continue adding cleanup infrastructure. Unimplemented general upload/Workshop/frozen-value cleanup is deferred rather than a prerequisite to further feature work or code integration.

The supplied Claude review accepts `2356f5c` as is and recommends integrating #53 → #65 → #66 while production remains gated, then Batch 4. Keep migration-9 triggers unchanged until real-D1 evidence establishes a necessary correction. The reported local save overhead (about 18% for migration 9 and a 35–40% cumulative estimate for v7–v9) is a measurement warning, not a platform result. Add save latency with these triggers present, before/after cleanup intent, to G/J's real-D1 measurement gate. Actual binding acceptance, owner Archive/inventory acceptance, data disposition and explicit activation remain required before cutover. Reviewer recommendations do not replace owner merge authorization.

### Recent changes: no engine port

Legacy Recent changes stores automatic changed-save workspace snapshots. It is neither a full-part restore nor a deliberate revision. Its Load this version path restores only the supported instruction-container/resource state, not all engineering records and files. Keep this legacy behavior readable until cutover, but drop inventory 8.3 in the engine. History records/events and deliberate Revisions supply the retained workflows. Do not add an automatic per-save timeline. A future per-save undo needs a separate explicit requirement and complete restore semantics.

### Owner item #17: Helpful tools

Helpful tools offers exactly Calculator and Tool as new reference types. Engine Tools come from the owner's D1 Workshop tool-type families/products, not the static `resources.js` catalog. Store the D1 identity and a last-known name. Archived sources show archived with the saved name; they must not become an unexplained missing link. References add no BOM quantity, cost, purchasing entry or feature-tree item. A tool used in the build may separately be a BOM item with Is a tool set; do not infer or create that item when linking a reference.

In legacy, hide only creation of Workshop-part references. Keep existing `resources.parts` visible/removable and preserve its stored shape and backups; perform no data migration. Other legacy Tool/Calculator linking behavior stays unchanged until the engine replacement. The retained static catalog currently has no tool-kind entries, so new Tool choices are empty; existing tool references still display through the old name fallback. Do not repopulate obsolete IDs or claim this small picker repair delivers the D1 engine picker. Calculator creation and existing Tool reference retention/removal remain covered.

At cutover, do not map legacy `resources.parts` IDs to guessed D1 products. Inventory their count per project, retaining enough labels/IDs in the disposition report for the owner to recreate useful links as BOM items or Knowledge links. Delete static catalog/wire readers only after D1 Tool selection and Workshop-wire harness replacements cover all active readers, including linked-part snapshot/photo/export dependencies.

Required acceptance: exactly two engine types; D1-sourced tools and readable archived-source names; reference add/remove leaves BOM/cost/purchasing/tree unchanged; backup/restore round-trips IDs and last-known names; disposition lists legacy part-reference counts per project. Legacy regression verifies the absent creation option, preservation/removal of saved part references and continued Tool/Calculator saves.

## Foundation review follow-ups before later batches

Owner storage refinement (November 24): users may keep large engineering files and project backups in their own storage; Dropbox is the planned later provider. The website remains responsible for stable identities, revision history, test evidence and exact external file-version references/hashes. Independent CAD/file revisions stay separate from part levels. Provider integration and unavailable-file feedback belong to the later file batch. External storage must not silently replace retained structured evidence. New checkpoints use deduplicated immutable values and references rather than repeated full histories; keep old readers and complete backup recovery. Archive supports 100 placements per action for now, with smaller child-group actions for larger trees. Actual Cloudflare capacity and cleanup/fencing remain explicit cutover gates.

The foundation was approved for integration while disabled in production; these are retained requirements, not reasons to rewrite its applied schema. Current release state belongs in STATUS.md.

1. In the identity batch, remove short_name from the model, editor and new backup contract, preserving old-format/historical compatibility. Do not expand its use. Keep migration 1's applied column or use an appended migration; do not rewrite migration 1.
2. Before project-owned events/records/steps land, add explicit ownership to the event model. Allow a project-scoped event without item_id, enforce the owning project, and retain item foreign keys for item scope. Review the D1-compatible table/dependent-reference migration, stable IDs, rollback and recovery. A fake item is not a project owner.
3. New-project UI must show editable prefix and digits; NR/4 is only a schema default. #53 already displays those inputs. Its acceptance must demonstrate an explicit BB/3 or TB/3 configuration and preserve it through restore, with no renumbering of existing items.
4. Preview vars do not inherit production vars. Remove duplicate config keys while retaining the reviewed normalized object: production AI setting unchanged, preview engine flag explicit, preview AI unset in #52. Confirm actual deployed version bindings later; do not claim a live check from Wrangler alone. Inspect later branches for their own explicit overrides, and do not make a provider call just to diagnose a flag.
5. Complete the live control-plane run of the acceptance runner already introduced in #66 after its review/integration. Use owner-created read-only Workers version access in a trusted runner secret. That endpoint returns D1 binding IDs; current code needs no D1 API permission. Only add a narrowly justified D1 read permission if a reviewed future runner actually uses that API. No write/R2/zone/global-key permission is needed. Exact token and secret-store steps are in PREVIEW_OWNER_SETUP.md. Historical same-logic proof remains evidence of its pinned runtime, not a fresh binding attestation.

6. Assembly and Workshop configuration identity uses only saved design details, exact engineering-file identity, frozen product facts/requirements and logical component quantity/unit/design. Project labels, placement IDs/order, checkpoint counters and build status are excluded. Every test/revision retains the exact placement tree and operational context separately. Old configuration/snapshot formats remain immutable and readable.

## Original detailed plan (review version 1)

The following captures the full design and acceptance catalogue. Earlier review language is historical; the approved decisions above take precedence. Batch 7's trial is conditional, not the default release path.


Owner review version 1

Prepared for Ryan Schmidt by Codex

November 22 2026

## 1 Recommendation and review decisions

I recommend rebuilding project History and removal on D1, keeping file bytes in R2 and continuing to host the application on Cloudflare. The replacement should use one project data model and the shared interface system. Its two user-facing views are History, which explains what happened, and Removed items, which finds and restores things no longer in the build.

This is a project-system rebuild delivered in small working batches. It includes the part and assembly foundations needed to make History accurate. It is larger than replacing an archive panel, but avoids building a permanent set of adapters around the old mechanisms.

This document is a proposal for your review. Creating it does not authorize implementation, production schema changes, cutover, or deletion. The existing website remains unchanged. After you approve the direction and review decisions, implementation can begin on isolated branches and preview storage. A significant production cutover remains a separate approval gate.

### Decisions to review

| Decision | Recommended default |
| --- | --- |
| Architecture | D1 for structured project state and History; R2 for immutable file bytes. Keep Cloudflare hosting. |
| Editing | One details editor with an optional Save as revision choice. A dedicated Change selected product action uses the same review and commit pattern. |
| Item identity | A project item is a permanent role or work unit. A tree occurrence is its placement. Ordinary duplication creates an independent item; identical products do not automatically share project notes or tests. |
| Existing project data | Build the replacement with disposable fixtures. Prefer a fresh start for legacy project data, subject to a specific inventory of what would be retired before cutover. Preserve Workshop, Knowledge and account data. |
| Permanent deletion | Defer file purging until the core workflows and file reference accounting are proven. Removal and restoration come first. |
| Release approach | Prove one complete custom-part workflow, then Workshop parts and assemblies, then feature parity. Keep one writer per project; never synchronize edits between the old and new engines. |

The owner reviews product behavior and data disposition. Claude reviews the technical schema, transaction design and pull requests. Codex implements approved batches. SQL details and module boundaries may change during technical review, but identity, behavior, and acceptance requirements must remain explicit.

### Success means

- You can find an earlier decision or removed item without expanding a chain of archive panels.
- Canceling an edit changes nothing. One successful revision produces one History entry, even after a lost response and retry.
- Tests retain the exact configuration they describe, including values resolved from Workshop at the time.
- Removing one placement does not remove another placement or destroy shared files.
- New code replaces old owners and styles as each area is retired. The end state has one project engine, not two maintained implementations.

## 2 Verified starting point

The code baseline is GitHub main commit 091c9a46c53e8cd93f28ed2e4501e49d8526896f. Recheck main before implementation; this document does not incorporate later unpublished edits. The last validated release reported 231 Node tests and 68 browser tests. No tests for the proposed replacement have been executed yet.

Recent work already supplies a common site header, shared section and field-row components, matching part-information tiles, remembered summary disclosures, a shared pane resizer, and strict CSS producer checking. Reuse these components. Rebuilding History is not permission to replace the site's design system again.

The existing system has several materially different mechanisms:

| Mechanism | Verified behavior |
| --- | --- |
| Removed tree items | R2 manifests and copied assets; tree and component updates are separate conditional writes. |
| Archived records | Investigation records get an archived lifecycle flag; there is no matching restore-record action. |
| Retired instructions | Steps carry archive metadata and have their own restoration path. |
| Saved part revision | A part/workspace snapshot is saved before the replacement editor opens. Canceling the later edit does not remove that snapshot. |
| Recent changes | Workspace recovery snapshots cover instruction containers, linked resources and experiment state, rather than a full part/project rollback. Snapshots are created for changed saves with an existing prior state, not every no-op save. |
| Workshop project uses | D1 rows have a separate archive flag. The R2 subtree-removal path rejects mixed subtrees containing active Workshop uses. |
| Component recycle copies | Deleted definitions and some linked bytes are copied to recycle-bin. There is no normal restore interface, and that prefix is outside the current project export allowlist. |
| Project backups | The current project import validates an export; it does not apply a live restore. |

Keeping original files after removing an archive copy is not automatically a defect: some originals can still be shared by active work. Determine actual references before deleting bytes. Likewise, a static CSS producer check is useful evidence, not proof that every remaining rule executes in a real screen.

The approved feature inventory remains the preservation checklist. Blank decisions mean Keep. A successful History preview does not mean BOM, drawings, source-code history, photos, numbering or backups are complete.

## 3 Product behavior

### History

Add one History entry to project navigation. The page has History and Removed items views, a visible scope selector, search and a small type filter: All, Tests, Problems, Changes and Notes. Entering from project navigation selects the whole project. Entering from a part selects that item. Including assembly descendants is an explicit option.

Use one flat list and one selected detail pane. Each list row contains a title, type, source item, a short outcome when available, and a subdued timestamp. Do not add permanent Edit, Archive and Delete buttons to every row. Selecting a row opens a readable detail; it does not open another nested accordion chain. The desktop list/detail boundary uses the shared resizer. On a phone, details occupy the available width with Back to history. Returning restores scope, filters, selection and scroll position.

Part and assembly workspaces show a short History section with the latest relevant entries, View all history and Add record. The step view and project History link to the same record IDs. Showing a record twice in different contexts never stores a second copy.

### Ordinary edits and deliberate revisions

Keep one details editor. Save changes updates current information. An optional Save as revision choice exposes an optional reason and a review of the actual changed fields. Its final action is Save revision. The owner decides whether a change deserves a checkpoint; the application does not guess significance from every field edit.

Cancel closes the draft without writing current data, a configuration, or a committed History event. An unchanged save creates no engineering change or History entry. A retry receipt may exist internally, but it must not appear as a revision. Validation or network failure keeps the draft visible with a useful error. A stale draft receives a conflict and a comparison; it never silently overwrites newer work.

For example, changing a bracket thickness from 3 mm to 5 mm can be saved as a revision. History then shows the difference and any reason supplied. The example is illustrative; no measurement or production change is asserted.

### Selecting a different purchased product

Change selected product belongs in Part details. Search and select within the existing Workshop family/product system. Review the old and proposed selections and relevant requirement differences before saving. One successful commit updates the project selection and creates one intentional change entry.

The operation retains the project item's identity, requirements, instructions, notes, files and records. It does not edit a Workshop family or product. Switching back later is a new change. Considering a candidate without saving it creates no change entry. A mismatch is presented for review; the application must not claim engineering equivalence or successful validation.

### Recording tests and problems

Add record opens an editor in the current project/item/step context. Keep existing meaningful record content, attachment support and identifiers. Present appropriate optional prompts for tests, problems, notes and historical change notes. Photo-only evidence can be represented as a note with attachments; preserve any existing content and links when mapping old types.

Timestamp automatically. A separately entered event date remains optional. Do not invent old dates or require a title, body and date when one useful description is sufficient. Resolving a problem keeps its evidence visible in History. Do not require Archive as a filing step. Knowledge tiles and Milestones remain deliberate actions that open drafts; no automatic copies are created.

### Removing and restoring work

Remove from build is available from a visible More menu; right-click is a shortcut. Confirmation names the occurrence, its current location and affected subtree. A reason is optional. Success returns to a sensible active parent and offers Undo removal. Undo invokes the same protected restore operation as Removed items.

Removed items shows recognizable names and original locations. Its details reuse the read-only information layout and expose relevant instructions, records and files. Do not lead with raw JSON or storage-object counts. Restore previews the destination and checks identities, reserved part numbers, membership and shared definitions. If the original parent is unavailable, require an explicit valid destination. Never silently overwrite or renumber.

Retire step removes an instruction from the active list while keeping its records. Restore step returns it. A retired step belonging to a removed item cannot be restored to an inactive destination without first resolving that destination.

## 4 Ownership and identity rules

The schema must implement the following distinctions before implementation proceeds. They are behavioral requirements, not merely naming choices.

| Information | Authority in the replacement |
| --- | --- |
| Reusable family definitions and products | Existing Workshop tables. Project edits never alter these rows. |
| Project role and engineering requirements | Project item, with a stable ID, name, configured number, project notes and current selection/design. |
| Placement and build state | Occurrence: parent, position, quantity/unit, build status, attention state and active/removed state. |
| Instructions | Stable steps owned by a project or project item, including assemblies, documents and code items. |
| Evidence | Stable record with project/item/step context and an optional explicit occurrence context. |
| Configuration used by evidence | Immutable snapshot captured when that evidence is recorded. |
| Deliberate historical action | One event referring to the affected identities and frozen configurations. |
| File content | Immutable R2 object registered by file ID; its retained owners are explicit links. |

A project item supports assembly, part, document and code kinds. Purchased/custom is a sourcing/design choice, not a substitute for item kind. Parts may link to a family/product; assemblies must support their own instructions and records. Project-level instructions and records have explicit project ownership rather than a fabricated part ID.

An occurrence belongs to one project and refers only to an item and parent in that project. Parent cycles are invalid. A removed subtree carries a removal operation ID so restoring a parent does not accidentally reactivate children that were removed earlier. Original paths are captured at removal and remain readable after later renames.

If several placements intentionally reference one item, its design, item-level instructions and general notes are shared. Placement quantities and status remain independent. Tests specific to a physical placement carry its occurrence ID and a frozen location/context. Ordinary Duplicate creates independent item and occurrence IDs; identical product numbers or names never imply shared project evidence.

### Resolving the existing Workshop use overlap

The target has one authority for a project's selected product, requirements and purpose. It must not store independently editable copies in both project_items and workshop_uses.

Recommended target: new project items own the project-use information; Workshop continues to own reusable families, products and field definitions. New projects do not also create legacy workshop_uses rows. The Workshop's list of project uses reads the new project service once those readers are replaced. Existing legacy uses remain associated with the old engine until cutover. This is a finite transition, not a dual-write scheme.

Claude's schema review may choose to retain and extend workshop_uses instead, but only with an equally explicit single source for name/purpose, quantity, location, selection and requirements. Resolve this technical choice in the schema gate. Do not create a wrapper that stores the same mutable fields twice.

## 5 Proposed D1 model

Use the same logical D1 database as Workshop and Knowledge so a product-selection operation can guard source revisions and project changes in one database transaction. Preview uses a separate database containing the same schema. Do not create a second production database and assume batches span both.

This is a proposed table shape, not approved SQL. Use the repository's numbered, append-only migrations; assign the next unused number after checking current main. Add only the columns needed by the first complete workflow, then extend in reviewed batches.

| Table | Responsibility and principal fields |
| --- | --- |
| projects | Catalog, settings, summary, configured numbering and storage format; project revision and tree revision. |
| project_items | Stable ID, project, kind, role/name, part number, source kind, local details or selected family/product and requirement values, current configuration reference, revision. |
| occurrences | Stable placement ID, project/item/parent references, ordering, quantity/unit, build state, removal metadata, revision. |
| steps | Stable ID, explicit project or item owner, title/order, active/retired state, retirement context, revision. |
| records | Stable ID, project/item/step/occurrence context as applicable, type, problem status, fields and stable nested entries, event date, timestamps, configuration/context reference, revision. |
| configurations | Immutable normalized display and engineering snapshot with owner, content hash, source IDs/revisions and protected file references. |
| history_events | Committed intentional action, owner/context IDs, before/after configuration references when applicable, optional reason/label, operation ID and timestamp. |
| files | File identity, owning scope, immutable R2 key, name/type/size/hash, readiness/deletion state and timestamps. |
| file_links | File-to-owner links for projects, items, configurations, records, steps and retained Workshop references where relevant. |
| operations | Project-scoped operation ID, actor, action/target, request fingerprint, guarded-attempt token, committed result and timestamp. |

Avoid a second item_versions table that duplicates the same change title, reason and timestamps already owned by history_events. Configurations provide immutable state; History events provide the intentional transition. A user-facing drawing revision label is optional and separate from concurrency revision counters.

### Constraints and indexes

- Enforce project-scoped ownership for parent/item/record links. Validate polymorphic file owners centrally; a plain owner_type/owner_id pair does not create a foreign-key guarantee by itself.
- Keep item numbers reserved across active and removed work. Preserve each project's configured numbering behavior; this rewrite must not silently reset prefixes or renumber existing items.
- Index project/scope/time and type for History pagination; project/state/parent/order for tree and Removed items; owner/file ID for link checks; and project/operation ID for retries.
- Use a stable time-and-ID cursor. Two entries with equal timestamps must not disappear between pages.
- Preserve false, zero, empty/unset distinctions, stable field IDs, units and labels. Do not truncate fields silently to fit a new row budget.
- Put binary bytes outside D1. Prove limits with realistic large fixtures; use bounded lists and references to child configurations for large assembly snapshots.

## 6 Accurate configurations without a noisy timeline

An internal configuration is different from a visible revision. Capture an initial configuration and capture the exact current effective configuration when recording new evidence. Ordinary editing can change the current configuration without creating a History event. A deliberate revision creates one event linking the previous and new snapshots.

This closes a gap in the earlier schema: a record's version_id cannot accurately describe a test taken before the first deliberate revision, or after an ordinary specification edit, unless the actual tested configuration is also retained.

A snapshot includes the item kind and relevant design fields; selected family/product identity; resolved product name, manufacturer and MPN; stable field IDs with displayed labels, units and values; project requirements and overrides; relevant engineering file IDs; and source revisions used to resolve the values. For a placement-specific test, freeze location, quantity and other relevant context separately from the reusable item description.

For an assembly or whole-project test, capture a bounded composition of occurrence IDs and child configuration references. Do not re-resolve that composition against future live rows. This capability must be tested before assembly/project-level tests become available in the replacement.

Capture source values on the server. Guard the product/family revisions used to build the snapshot. If the Workshop changes between opening an editor and committing, require review or retry with current source data; never silently merge different generations. Older imported evidence without reliable configuration context is labeled Unknown rather than assigned a made-up version.

Do not snapshot whole projects or copy every file for each edit. Retain immutable file references. Change comparisons show changed fields by default, with View previous details for the full saved context. A saved revision does not certify that a design was built, safe or successfully tested.

## 7 Transaction and retry contract

Every new mutating route requires the existing owner session, a same-origin check, explicit expected revisions and an operation ID. New routes must not inherit the legacy optional-revision behavior. Two browser tabs still need conflict protection even in a single-user application.

D1 batch transactions roll back SQL failures. An UPDATE that matches zero rows, however, can succeed as SQL. Checking its row count only after the batch has committed is too late if later statements wrote history. The replacement must prove a guarded transaction rather than equate batch() with a complete concurrency solution. [S3]

### Proposed operation sequence

1. Authenticate and authorize the project and every referenced item/file. Validate and normalize the requested action without writing engineering state.
2. Compute a fingerprint from the action, target, expected revisions and normalized payload. Scope the client operation ID to its project and actor. Reusing an ID for a different request returns a conflict.
3. Check for an already committed matching operation. A successful retry returns its stored result before evaluating the now-stale expected revision from the original request.
4. Read the current state and source revisions needed for validation and a proposed frozen configuration. Check meaningful differences; preserve the draft on validation failure.
5. Execute one D1 batch. Its first guarded statement admits a fresh attempt only if every relevant revision, source, parent and readiness condition still matches. Use a server-generated attempt token so a receipt from another attempt cannot authorize following writes.
6. Gate every dependent configuration insert, item/use update, subtree state update, History event and result receipt on that admitted attempt. A stale guard must produce no dependent engineering writes. A later SQL/constraint failure must roll back the whole batch.
7. Return the committed result, IDs and new revisions. A duplicate operation returns the same result; it does not create another event. No-op handling must be documented and produce no visible revision or configuration churn.

The exact SQL needs review against real D1 before it becomes a shared store primitive. Include unique-operation races, source changes and mixed subtree changes in that proof. Do not introduce a generic event bus, transaction framework or replay-based state model. Current rows remain authoritative; History is an account of deliberate actions.

Tree operations guard a project tree revision in addition to the affected rows. Item and record edits guard their own revisions. This avoids treating an unrelated note edit as a project-wide tree change. Removal/restore validates the whole selected subtree within the same guarded operation.

## 8 File lifecycle

Register each new upload with an immutable file ID and R2 key. Replacing a drawing, photo, saved webpage or code file creates a new object/reference. Editing photo markup preserves the original and creates a retained annotation/render generation. A historical configuration must not point at a mutable current thumbnail or render URL.

D1 and R2 do not share a transaction. Upload bytes first into a prepared state, verify their size and hash, then admit them to a committed owner through D1. Only ready files can be linked into saved engineering state. If the owner save fails or the browser closes, the prepared bytes are not a completed project edit. Provide an observable, retryable cleanup path for abandoned uploads; defer automatic sweeping until the path is tested.

Existing Workshop files require an explicit retention rule. Reuse a file when its identity is already immutable and protected by shared reference accounting. If an older source can be overwritten, adopting a historical reference may require one immutable copy. That exception is different from copying files every time a part is removed. Never assume that a project-only file_links query accounts for all Workshop or legacy users of an object.

### Removal and deletion are different

Remove/restore changes D1 state and creates no R2 copies. Retaining a removed item retains its files and configuration references. Deleting an item later can release links, but cannot automatically delete a file still referenced by a record, snapshot, step, Workshop object or another project.

Permanent purging is a later batch. Its design must first mark a candidate as deleting in D1 while preventing new links, verify all retained owners, delete R2 bytes with an idempotent retry, and finalize metadata. A crash between those steps must remain recoverable and visible. Do not perform an unguarded check-then-delete. No automatic retention schedule is proposed.

## 9 API and module boundaries

Route names below are illustrative. Confirm them against the existing Worker router. The contract matters more than introducing a new URL style. Keep source-specific modules small and use ES modules with explicit initialization. Shared interface components remain in the kit; page modules own layout and controllers.

| Operation | Required behavior |
| --- | --- |
| Read History | Scope, type, text search and stable cursor; records plus committed events, with stable source-qualified IDs. |
| Read Removed items | Removed occurrences and retired steps across the project; available even after a former parent moves or disappears. |
| Read prior configuration | Owner-protected, immutable, readable snapshot and protected file links; no implicit restore. |
| Save details | Revision-checked current edit; no visible History event unless deliberately requested. |
| Save revision or selection | One guarded operation for the new state, immutable context and one event. |
| Add or edit record | Stable record identity, conflict protection, attachments and exact configuration/context capture. |
| Remove or restore | Explicit occurrence/subtree, preview and checked destination; one operation receipt and event. |
| Retire or restore step | Stable step identity and preserved records; no invented part archive. |
| Prepare or attach file | Immutable bytes, readiness verification and protected link admission. |
| Backup and restore | Versioned format, complete references, integrity checks, preflight and demonstrated restoration. |

Recommended module groups are project store and commands; tree/membership; configurations and History queries; records and steps; files and links; and backup/restore. Share authorization, guarded admission and retry receipts. Do not force unrelated record editors into one universal schema abstraction.

Keep list reads small. Do not enumerate every R2 object to render History, load full snapshots for unselected rows, or request retired 410 endpoints. Use indexed D1 queries and load the selected detail on demand. Pagination, query length, row budgets and subtree limits must be documented and tested. D1 currently documents a 2 MB maximum row/string size, 100 bound parameters per statement and a 30-second query/batch duration limit; implementation must reconfirm current limits and stay comfortably within them. [S4]

## 10 Implementation batches and release gates

The batches below define reviewable outcomes, not promises that each fits one chat session. Split a batch when its diff stops being reviewable. Every batch has a branch, meaningful tests, a clear deletion boundary and an updated inventory. A completed backend with no demonstrated user flow is not a release milestone.

### Batch 0 Agree on behavior and schema

Deliver the reviewed owner decisions, ownership map, schema sketch, source-dependency inventory and a feature-preservation checklist. Resolve the Workshop-use ownership choice and shared-item behavior. Review the exact guarded-operation SQL with Claude. Record what will be kept, mapped or retired in existing project data.

Gate: owner approval of this plan's direction; technical review of identity and transaction design; explicit preview/production isolation. No production migration or data deletion.

### Batch 1 Prove the D1 command foundation

On a preview branch, append the minimal migration for project/item/occurrence identity, configurations, records, events and operation receipts. Implement only the commands required by one custom part. Create disposable projects through the API rather than relying on built-in sample IDs. Preserve the existing login/private access model.

Prove stale admission, a late SQL failure, a successful retry after a lost response, and a reused operation ID with different content. Run these against the test database and an isolated Cloudflare D1 preview. Test doubles alone cannot prove Cloudflare transaction behavior.

Gate: every rejected command leaves engineering rows unchanged; every admitted command has one durable result. Do not merge a migration into a production path that automatically applies it until that production release is approved.

### Batch 2 Deliver the complete custom part flow

Build an ES-module project preview using the shared header, information tiles, buttons, sections, dialogs and pane resizer. Support one custom part, its instructions and test/note records, optional revision saving, a basic History/Removed items page, removal and restoration. Add one immutable attached engineering file and demonstrate that old configurations still open it after replacement.

Exercise the full owner flow: create part, edit details, record a test, save a deliberate revision, inspect the earlier test/configuration, remove the item and restore it. Include Cancel, failure, stale-tab and no-op cases. Add a verified preview backup/export and actual restore of this slice before treating it as recoverable.

Gate: owner can review a working preview with desktop/phone evidence; no production switch; no silent dependence on old project endpoints.

### Batch 3 Add Workshop items and assemblies

Connect reusable families/products to new project-owned selections and requirements. Guard source revisions and freeze display values. Update Workshop project-use readers for the selected ownership design. Add assemblies, ordered child placements, quantities and status, shared-definition occurrence tests where applicable, and assembly-level records with frozen composition.

Implement mixed custom/Workshop subtree removal in D1. Preview descendants and check dependencies. Capture removal groups and original paths. Restoring a group must preserve children that were already removed before that group. Keep the item and occurrence identities intact.

Gate: mixed assembly remove/restore is one guarded command; other placements stay active; R2 object counts and bytes do not change. Existing Workshop editing and Knowledge links continue to work.

### Batch 4 Complete records and History interaction

The owner's speed policy controls Batches 4–6, narrowed by the early-live sequence above. Plain screen/editor/History changes may self-merge after Node, browser and Cloudflare preview checks pass; database/migration, backup/restore or save-guard changes still require Claude review. Production activation remains separately authorized. Keep existing tests, add a feature's success case plus its main failure case, and defer optional hardening in one-line FOLLOWUPS entries. Stop and report a task that runs about two hours beyond expectation. STATUS has at most three lines per PR, current/next only. Implement only the requested Keep/Rebuild group; ask before adding unlisted work. Backup/recovery stays frozen at schema 9, bug fixes only; merged #71 instruction metadata compatibility adds no recovery mechanism.

Deliver this batch as two sequential PRs, each merged before the next starts, using the owner's review exceptions above. Batch 4a owns instruction/record editors, ordering, named attachments, instruction revisions and header/subtree revisions. Batch 4b owns History scope/type/search, pagination, comparison and selection/scroll preservation. Start 4a only after #53 → #65 → #66 integrate with production still gated. This split changes delivery order, not the retained requirements below, and must not become another long stacked chain.

Complete the shared step/record editors, existing nested-entry content and ordering, attachment names, explicit event dates, problem resolution and stable links. Finish scope/type/search pagination, readable prior-state comparison, and preservation of selection/scroll on navigation. Keep scratch notes distinct from engineering records.

Batch 4b implements part/project scope, record/revision types, search, counts and cursor pagination through the existing read APIs. Archive has separate part/instruction type filters, reason search and paged presentation of the existing workspace state. Selecting a record directly can open its detail without loading every older History page. Selected identity, filters, loaded page count and desktop-list/phone-page scroll survive edits and navigation through the part page; the newest clicked entry owns the detail pane. Failed reads have explicit retry controls. Read-only comparisons cover saved versus working part details, or the captured instruction subtree's text, revision references, membership/order and record fields/attachments. Their labels state the compared boundary; full frozen evidence remains readable below. This is display-only: no schema, backup, command or save-guard changes. Claude's Q wait now polls for committed revision state instead of accepting any transient prompt text. Full parity and real-platform acceptance remain owner gates.

Introduce optional Make knowledge tile and Add to Project Milestones only through their existing deliberate draft flows. Do not make this batch depend on new speculative Knowledge features. Retired instructions appear in Removed items with their original context.

Gate: every existing Keep behavior for instructions/records has a passing acceptance case, and each source appears once in a filtered History result.

### Batch 5 Restore the remaining project features

**Current delivery scope:** the early-live sequence above limits pre-switch work to the supplied BATCH5_IMPLEMENTATION_BRIEF.md 5a rows, nightly backups and photos. The brief, BATCH5_FEATURE_MAP.csv and historical BATCH6_DISPOSITION_PREP.md are retained as source analysis; their older commit/status/retirement recommendations are superseded by the owner's no-delete/no-import direction. The rest of this section describes retained later work, not switch-over blockers.

5a decisions under the owner's delegated judgment: keep the engine's 180-character project-name limit and show it; show next assembly/part numbers without changing saved numbers; omit old nomenclature guidance from settings; retain Change Workshop selection and explicit Save/draft warnings. Defer AI lookup to Workshop and independent part-type/identity fields to their later batch. A project-only product copy requires explicit off-the-shelf confirmation, opens a reviewed Workshop draft, copies physical fields/specifications only and leaves the project unchanged. Tree visibility filters are local display choices, not membership edits. BOM list grouping uses known assembly/part flags; legacy shop-material grouping needs a future equivalent of assumedOnHand and is deferred rather than inferred. Readable HTML separates Archive from active placements/parts. Instruction navigation reuses the shared resizer and existing editors/revision semantics.

Writer ownership: #73 is merged. The owner directed Codex to decode and checksum-verify Claude's three v3 patches from issue #74, apply them in order on a new branch from main and open one integration PR. Those v3 comments supersede all earlier raw patches. Claude authored and reviewed the supplied migration-11 media and daily-backup changes; do not create a second implementation. Any substantive integration deviations still need the applicable review.

Issue #74's reviewed implementation uses engine_media rather than the earlier brief's engine_item_files. Project scope is item_id=NULL; photo and picture are the only API roles now, with one active part picture. Other file roles are CHECK reservations, not implemented features. Backup compatibility includes the optional media table and existing cleanup deletion order, with no new cleanup caller or recovery protocol. Markup/annotation and gallery membership in saved revisions remain deferred as stated in Claude's handoff; original media bytes and removed rows remain in whole-project backups. Owner activation approval has now been granted in this chat; retain it while completing integration, required reviews, legacy read-only preservation and real-platform acceptance rather than asking for the same approval again.

Move the remaining inventory in small area-specific PRs: project settings/summary/numbering; BOM, parts management and DigiKey purchasing; photos and markup; drawings, saved webpages and other engineering files; source code and its history; Milestones and unstructured notes; harness cutting lists using Workshop wire products; readable and machine-restorable backups.

Preserve configured numbering, nested quantity calculations, tool/document filtering, project-only changes and file/implementation scoping. Delete corresponding legacy owners and CSS only when their replacement covers the behavior. Reuse the shared resizer for the feature tree when that area moves. Remove static sample-project production behavior after API-created fixtures and catalog coverage replace it; do not invalidate an existing saved ID merely because it used to be a sample.

Gate: every Keep line has a specific replacement and test, or an explicit owner-approved scope change. Existing multi-step workflows, not only isolated pages, pass.

### Batch 6 Decide legacy data disposition

**Superseded by the owner's early-live direction:** keep legacy pages/data read-only; delete and import nothing. Optional individual migrations are later separate work. The historical disposition options below do not authorize cleanup or block the reduced switch-over.

Produce a concrete report of legacy projects, records, files, archive copies and references affected by cutover. Do not assume that a newer BuildABoard project is disposable solely because earlier placeholders were. Reuse the owner's tolerance for test-data loss while identifying exactly what would be lost.

Recommended default is a fresh project start if the inventory confirms only disposable data. Keep the reusable Workshop catalog, Knowledge tiles and account settings. Report Knowledge/Milestone links into old projects so the owner can choose to retain, relink or knowingly retire those targets. Do not silently erase reusable knowledge with project test data.

If selected projects must be imported, treat conversion as a separate tested job. Preserve stable IDs and original timestamps where reliable; map nested records, attachments and file references; retain unknown historical context honestly. A conversion touching many prefixes is not assumed to be a small script. Never run competing old/new writers for the same project.

Gate: owner reviews the exact disposition report and any conversion results. Export and verified restoration are available before irreversible cleanup.

### Batch 7 Conduct a production trial and cutover

**Current approval boundary:** use the reduced pre-switch package above. Full inventory parity and legacy conversion are no longer required for activation; read-only legacy preservation and explicit owner approval are required.

After preview acceptance and explicit production approval, release additive code/schema and a limited new-project trial. Confirm actual production bindings, login, routes, file access and representative saved operations. The old engine remains reachable for designated legacy projects under a clearly defined read-only policy; enforce that policy on the server, not just with hidden buttons.

Route each project by an explicit storage format. New projects use only the new engine. The temporary catalog can list new D1 projects and read-only legacy entries, with one canonical writer for each. Do not build a permanent general compatibility layer or synchronize updates across engines.

After owner use and full parity verification, make the new engine the default. Recheck hashes, counts, references, backups and recovery behavior before declaring cutover complete.

Gate: owner acceptance of live workflows and verified recovery. A green GitHub run alone does not prove the Cloudflare deployment or its bindings are correct.

### Batch 8 Retire legacy code and data deliberately

Fold current guidance into maintained docs. Remove legacy routes, scripts, styles, schemas/readers and sample behavior only after the dependency checklist is clear. This includes the resources.js backend readers as well as its old frontend editors; moving calculators alone does not make the file safe to delete.

Keep a short, explicitly bounded recovery period for the legacy dataset. Data deletion is a separate reviewed maintenance operation after cutover acceptance, not a hidden side effect of the same merge. Its deletion list must distinguish project-owned files from accounts, shared Workshop/Knowledge assets and retained snapshots. Never delete a whole bucket or database as a shortcut.

Gate: zero production requests to retired routes; zero remaining required readers; engineering records remain reachable in the selected new/recovery path. Declare any deliberately irreversible retirement before executing it.

### Later batch Permanent deletion

Implement purge only after shared reference accounting and deletion recovery pass their tests. It is not a prerequisite for useful History, removal or restoration. No new backup dashboard or scheduled purge feature is included.

## 11 Acceptance tests

These are behavioral release criteria. Add tests in the batch that introduces the behavior. Keep useful existing tests; replace implementation-shaped assertions only when the behavior is covered elsewhere.

### Save and concurrency

- SAVE 01: Cancel a new or edited revision. Current state, configuration references and History remain unchanged; prepared uploads are not presented as saved work.
- SAVE 02: Save unchanged values. No visible revision, duplicate configuration or updated engineering content is created.
- SAVE 03: Save a normal detail edit. The current view updates with no human History event; a later test still captures the edited configuration.
- SAVE 04: Save a revision. Exactly one current-state transition and event commit with the displayed before/after values.
- SAVE 05: Two tabs save the same expected revision. One succeeds; the loser receives 409 and retains its draft. No losing history/configuration writes survive.
- SAVE 06: Change a family/product between read and commit. The source guard rejects mixed generations without changing the project.
- SAVE 07: Inject an SQL failure after early statements. The item, events, links and operation receipt all roll back.
- SAVE 08: Drop the response after a successful commit and retry. Return the original IDs/result, with exactly one event and one completed operation.
- SAVE 09: Reuse an operation ID with a different body, target or action. Reject it; never replay the previous response as a different change.
- SAVE 10: Prove the zero-row guard case directly. A stale UPDATE cannot be followed by successful unguarded inserts.

### Evidence and historical accuracy

- HIST 01: Record a test before the first deliberate revision. Its exact initial configuration remains available.
- HIST 02: Edit a specification normally, then record a test. It links to the edited values even though the edit produced no History event.
- HIST 03: Rename Workshop fields/products or change source values later. Earlier evidence preserves its displayed labels, units, values and files.
- HIST 04: Resolve a problem. It remains searchable in History without archiving.
- HIST 05: Display a step record in both its step and project History. It remains one record with one stable ID.
- HIST 06: Paginate equal timestamps and combine scopes/types. No missing or duplicated results; sort remains stable.
- HIST 07: Navigate into and back from a detail on desktop/phone. Preserve filter, scope and list position; use one selected pane rather than nested modal stacks.
- HIST 08: Import evidence lacking a reliable old configuration/date. Show Unknown; do not invent a successful replacement or validation.

### Removal and restoration

- REMOVE 01: Remove one occurrence of a shared item. Other placements, files and records stay intact.
- REMOVE 02: Remove a mixed custom/Workshop subassembly. All selected membership changes and its event commit together, or none do. No R2 copies are created.
- REMOVE 03: Remove a child first, then its parent group. Restore the parent group; the previously removed child stays removed.
- REMOVE 04: Rename/move/remove the former parent. The old original path stays readable, and restore requires a valid explicit destination.
- REMOVE 05: Encounter duplicate IDs, reserved numbers, a changed shared definition or an invalid/circular destination. Reject restore with useful details and preserve active work.
- REMOVE 06: Retry removal/restore after a lost response. Return the same result without a second event or duplicate nodes.
- REMOVE 07: Use Undo removal. It runs the same checks as normal restore and does not bypass a newly introduced conflict.
- REMOVE 08: Retire and restore a step. Its records and file links retain their identities; an inactive owner is handled explicitly.

### Files and recovery

- FILE 01: Replace a drawing/photo/code file. Earlier configurations still open the earlier immutable content, with original bytes and metadata.
- FILE 02: Interrupt an upload or owner save. No broken saved link appears; prepared state is observable and retryable.
- FILE 03: Access a file through History or a removed item while signed out. Owner protections still apply.
- FILE 04: Retain a Workshop/shared file through a project snapshot. Source cleanup cannot delete the retained bytes.
- FILE 05: In the later purge batch, preserve every referenced object and recover interrupted deletion without accepting a new link to a deleting object.
- RECOVER 01: Export and actually restore a project into an isolated target. Compare stable IDs, engineering fields, frozen configurations, records, events, file links and file hashes.
- RECOVER 02: Reject a corrupted, oversized or cross-project backup before changing visible work.
- RECOVER 03: Restore with conflicting active state. Preflight identifies the conflict; no silent overwrite, renumber or partial promotion.
- RECOVER 04: Exercise code rollback after new-format writes. New data remains readable/exportable through the supported recovery release.

### Interface and preservation

- UI 01: Complete all primary flows with keyboard and touch at 390 px, tablet and desktop widths, without clipping or hover-only actions.
- UI 02: Verify shared typography, header/section/control geometry, fields and resizers. Add no project-ID CSS or forced overrides.
- UI 03: Confirm no requests to retired endpoints and no new dead/unloaded modules after each replaced area is removed.
- PERF 01: Measure a cold, signed-in engine part-page open on a fixed populated fixture until ready and network idle. Target at most 20 non-image HTTP requests, recording API/data and static-shell counts separately, plus failures, redirects/retries and transferred bytes. This is a new engine target, not a measured pass or a gate retroactively imposed on legacy. Prefer one consolidated project/item read and file bytes on demand; do not hit the target by hiding required data or preloading it before measurement. Repeat navigation with a warm cache as a separate measurement. Claude's legacy review observed 136 total requests on one part page; retain that as attributed baseline evidence, not a universal or newly reproduced count. Any necessary budget change requires measured rationale and review.
- KEEP 01: Verify numbering/reservations, nested BOM quantities, tool/document filters, DigiKey handoff and independent project annotations.
- KEEP 02: Verify photo editing, CAD/PDF/code histories, named attachments, notes, Milestones and existing Knowledge source links.
- KEEP 03: Verify private access, disabled public registration and paused paid AI remain unchanged.

## 12 Backup and rollback procedures

Backup work here is limited to making the new project format recoverable. It does not add another backup-management interface. The current inspect-only import cannot be cited as proof of restoration.

### Required backup contract

A versioned export includes the new project rows, stable IDs, item/occurrence relationships, steps, records/nested entries, configurations, deliberate events, file metadata/links and verified retained bytes. List external Workshop/Knowledge dependencies separately. Restoring a project must not silently overwrite the reusable catalog or unrelated Knowledge tiles.

Validate hashes, sizes, ownership, references and schema version before promotion. Prepare file bytes outside the D1 commit, then promote project state only after verification. Establish a supported import size/operation limit from real fixtures; reject larger inputs before changing live data. Avoid a complex paged importer until a demonstrated project size requires one.

Round-trip fidelity means engineering content, identities, historical snapshots and file bytes are preserved. Live concurrency tokens/generation must be refreshed so old browser drafts cannot overwrite a restored project. Transport operation receipts need not be imported as replayable commands; specify their exclusion and reset behavior explicitly.

### Rollback by stage

| Stage | Procedure |
| --- | --- |
| Preview only | Revert or abandon preview code. Production remains unchanged. Keep test evidence; no production data rollback is needed. |
| Additive schema before new writes | Deploy the last compatible release. Leave additive tables in place. Do not roll back by dropping them. |
| Production trial with new data | Pause new-engine mutations if necessary, retain read/export access, and deploy a known compatible new-engine recovery release. Do not switch to an old-only build that makes new projects disappear. |
| Default cutover with legacy data retained | Route legacy projects back to their supported old engine only where appropriate. Preserve all new-format writes and recover them through the new-engine path. Never copy stale legacy state over newer D1 state. |
| After intentional legacy deletion | Code reversal alone cannot restore deleted legacy data. Use the demonstrated restore procedure and retained exports, within their proven scope. State this boundary before deletion. |

A failed release should preserve the user's draft and engineering data while disabling the failing action where needed. Rollback commands, compatible Worker version, schema version and dataset scope belong in the release PR/runbook. Record the result of an actual rehearsal rather than a statement that recovery should work.

## 13 Feature preservation and deletion checklist

The maintained FEATURE_INVENTORY.md supplies the detailed list. For every Keep entry, the release checklist identifies its new owner, API, meaningful test and verified screen. Styling a feature does not mark its full behavior rebuilt. No silent feature cuts are authorized by this proposal.

| Area | Cutover requirement |
| --- | --- |
| Projects and settings | Create/rename/archive/restore, search/tags, configured numbering, summary/cost/intent and project navigation. |
| Tree and assemblies | Reorder/move, occurrence quantities, filters/status, assembly instructions, valid parentage and predictable removal/restore. |
| Parts and Workshop | Stable role identity, selected product/requirements, custom/document/code behavior, project-only edits and source navigation. |
| Instructions and records | Existing prompts/content, nesting/order, attachment names, retirement and stable Knowledge/Milestone links. |
| Engineering views | BOM/parts management, grouped/nested quantities, purchasing, harness output and supported calculators. |
| Assets | Photos/markup, drawings, CAD files, saved product pages, source-code histories and protected downloads. |
| Recovery | Readable export, complete restorable backup, conflicts, checksums and a rehearsed rollback. |

Before deleting resources.js, replace its backend imports for linked-part snapshots, source pictures and export dependencies as well as its UI callers. Before removing an old storage prefix, prove no active, removed or retained historical view needs it. Before deleting a script or stylesheet, remove its routes/loads and verify the strict checks rather than retaining an unloaded compatibility file.

Migration candidates include components, trees, workspace JSON, investigations, archive manifests/copies, old revision objects, recycle copies, instruction histories, status, notes, code, drawings and asset metadata. Accounts, Workshop definitions/products, Knowledge and shared assets are not disposable merely because project placeholders are. The final deletion list must name actual keys/rows and exclusions; this document does not supply an executable deletion instruction.

## 14 Working rules and completion criteria

Use a branch per coherent batch, with no competing writer on that batch. Keep new JavaScript modules under the repository's agreed size limit; add the proposed no-growth/unloaded-file/budget checks in appropriately scoped PRs. Use plain HTML, CSS and ES modules without a new frontend framework or dependency unless separately justified and approved.

Preview bindings must be verified as isolated from production D1 and R2. Keep production credentials out of fixtures, logs and documents. Review migration auto-application paths: an unapproved schema change must not run merely because a shared initialization function was deployed.

Each PR states behavior changed, code/styles removed, data impact, inventory coverage, tests, screenshots and rollback. Claude reviews the schema and high-risk transaction/file changes before merge. The owner reviews the working flows and explicitly approves the significant production transition after this planning review.

The rewrite is complete when the new engine covers every retained behavior, History/Removed items work across supported item kinds, new writes do not use the legacy stores, the restore rehearsal succeeds, old code is retired at a clear boundary, and the owner accepts the production workflows. Deleting code or passing unit tests alone is not completion.

### Review checklist for Ryan

- Approve or change the D1/R2 direction and the single-editor revision workflow.
- Confirm independent duplication as the normal behavior, with shared placements only when explicitly intended.
- Review the preview's History list, previous-details comparison and restoration destination before full feature migration.
- Decide what to retain only after the concrete old-project and linked-Knowledge inventory is available.
- Keep permanent deletion outside the initial rollout.

### Review checklist for Claude

- Resolve project-use ownership without duplicate mutable fields; cover assemblies, documents, code and project-level records.
- Review all guarded-batch statements and retry fingerprints, including the zero-row and lost-response cases.
- Verify baseline/ordinary-edit configurations, assembly context, file lifetime and Workshop source guards.
- Review actual restore support and post-write code rollback, not just export validation.
- Require feature coverage and reader removal before cutover/deletion.

## 15 Sources and verification boundaries

[S1] Current repository baseline: Ryanschmidt224/engineering-challenge at 091c9a46c53e8cd93f28ed2e4501e49d8526896f. Relevant files include assets/investigations.js, assets/site-assembly.js, functions/api/investigations.js, assembly-archive.js, workspace.js, workspace-history.js, workshop-db.js, project-archive.js, assets/archive-layout.js and docs/FEATURE_INVENTORY.md. [Repository at the reviewed commit](https://github.com/Ryanschmidt224/engineering-challenge/tree/091c9a46c53e8cd93f28ed2e4501e49d8526896f).

[S2] Owner-supplied BUILDINGSCHMIDT_STATUS_AND_HISTORY_REWRITE_2026-11-22.md and the earlier BuildingSchmidt_History_Redesign_2026-11-22.md. This plan adopts their History/Removed items direction and D1 target while revising ownership, configuration capture, batch size, file deletion and rollback details. Their reported live observations are attributed to those reviews; this planning task did not perform destructive production tests or sign in to inspect private project data.

[S3] Cloudflare D1 database API documentation, reviewed November 22, 2026. Batch statements execute as a transaction and a SQL failure rolls back the sequence. Application-level stale-revision admission still needs explicit guards. [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/).

[S4] Cloudflare D1 limits, reviewed November 22, 2026. Reconfirm limits and the actual account configuration during implementation. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

This is a review proposal. No website code, schema, production setting or engineering record was changed to prepare it.


## Owner refinement: alternative-owned information (planned engine work)

Status: required for the engine alternatives/BOM batch after the current stack's targeted reviews; this is not implemented by the legacy Alternatives-row presentation change.

Use three layers. The role owns canonical name/number, purpose, requirements, acceptance criteria, instructions and History. Each project-owned alternative owns its specifications, manufacturer/MPN, supplier/order codes, price/package, photo, documents/files and product-specific project notes. Evidence retains its exact fixed configuration. Selecting an alternative changes only the selected data/pointer; a return A → B → A must restore A's information and file bytes exactly.

Workshop selection copies server-resolved facts with the existing guarded frozen-selection/file retention rules. Notes start empty, and later Workshop edits do not silently change the alternative. Explicit Reload from Workshop is a deliberate recorded action. A manual alternative copies every field and spec label/unit from the current alternative with blank values; no photos, file links or notes carry over. User-entered identity can be supplied during creation; never silently truncate a Workshop product name to the project's adjustable name limit.

The standard Alternatives row expands to name/MPN/source and a requirements comparison, with **Add alternative** and **Select…** actions. Select opens a confirmation showing changed product facts, optional reason and an instruction-review flag. Cancel writes nothing. Save change runs one revision-guarded, replay-safe command and History event. Instructions remain on the role; their review flag names the former selection and stays until Reviewed.

Requirement comparisons must be conservative: evaluate only explicit supported numeric conditions with matching labels and identical units. Blank/missing is **no value**; text, differing units or unsupported conditions are **not comparable**. A check mark means only that the entered numeric condition is met; it is not an engineering-equivalence or suitability claim. Do not guess conversions or derive compatibility from a shared name.

An entered nonempty duplicate MPN within the same role is blocked. A selected alternative cannot be removed; choose another or archive the role. Removing an unselected alternative retains every referenced historical configuration/file. Workshop archival leaves the frozen project copy available with a source-status note. Custom parts continue to use revisions, without alternatives. BOM and purchasing use only the selected alternative. History retains older-selection evidence; the current-selection evidence view filters to the selected configuration/alternative without duplicating records.

Extend only through new migrations. Export/restore includes all alternative fields and notes, selected pointer, immutable configurations/files and instruction-review flags. Required acceptance covers: frozen Workshop copy; a fully blank manual structure; A → B → A byte-for-byte restoration; unchanged role/instructions; numeric/missing/not-comparable comparison and cancel; one event on retries and preserved stale drafts; evidence tied to the original selection; selected-only BOM totals; removal/duplicate guards; full recovery round trip; desktop/phone screenshots of the row, list and confirmation. Preserve earlier backup/historical formats without rewriting an applied migration or a fixed snapshot.


## Future requirement: independent engineering-file revisions

File revision labels are independent of a project part's revision. A working/saved part at Revision D may reference a SolidWorks file at Rev A; revising the part does not automatically relabel or replace that file. Support native CAD, mesh/export and other non-photo engineering attachments, not only images. The current byte-retention/backup work does not yet implement this file-version interface.

Each file version needs its own immutable identity, original filename/type, user revision label, saved timestamp and content hash. Part configurations point to the exact version they used. Uploading or selecting a newer file must never change an older part revision or test's file reference. Labels are user data, not derived from part revision numbers or upload counts; do not guess embedded CAD revision properties. A derived STL may optionally reference the exact native CAD version it came from, while keeping its own version identity. Export/restore must retain labels, version identities, bytes and configuration/derivation links. The owner explicitly deferred implementation; include this in the later engineering-files batch.


## Proposed Work Instructions revision reuse

Use the same metadata prompt (What changed, Why, Notes, named photos), read-only disclosure, guarded commit, operation replay and immutable-file retention primitives as part revisions. The snapshot boundary is explicit: an individual instruction captures that instruction's content, records and file versions; a header/group captures its whole nested instruction subtree, membership and order. Preserve stable instruction/record IDs in the saved context. This proposal belongs to the queued Work Instructions batch after stack integration, not this presentation release.

Each instruction/group has its own revision sequence; creating one does not advance the part revision or relabel CAD files. The current scope remains a working draft. Standalone Create a Revision preserves the saved scope and advances it once; Save as revision preserves its previous saved scope then commits the edits; ordinary Save updates the working scope without advancing. A part revision still freezes its complete instruction context/version references at capture time.

Batch 4a implements this on the gated engine, directly after integrated main `fe3a107`. Feature migration 10 adds instruction parent/group/counter/archive-reason fields and record parent/order fields; applied migrations 1–9 and all recovery/cleanup executors remain unchanged. An instruction revision is one `instruction_revision` event with a format-5 snapshot and explicit scope. Groups capture descendants (including their saved retired state), membership, sibling order, records, original record context/audits and referenced immutable files. No descendant revision events are manufactured. Existing inline snapshots and hashes are not rewritten. Standard Save is in-place; an unedited Save as revision is a no-op with a UI explanation, while the standalone action deliberately permits an unchanged checkpoint.

Record attachments keep their flat immutable file links, with optional per-prompt `{id,name}` associations inside the saved record fields (12 per prompt, 20 MB per file; up to 60 distinct file IDs overall). Existing unassociated attachments still load without a forced audit edit. Photos are an explicit image-only Note variant, not a renamed engineering revision. Problems retain prior open/resolved evidence and can add Yes/No/Maybe plus How/Why. Crossing the No boundary clears the unsaved resolution text. Nested records stay within one instruction; moves are audited with frozen old/new parent names. Instruction/group archive hides descendants without changing their own retired flags or revision counters. Retired instructions are restored through existing guarded commands; no data is deleted.

Attachment upload retries retain preparation, byte-upload and admission identities after lost responses, including a lost final admission response. The working editor advances only for its own completed uploads. Revision/record drafts survive conflicts and require explicit review of newer saved content before accepting its token. Migration 10 means previous live binding/hash reports remain historical evidence for their pinned schema/head; fresh exact-version platform acceptance is still required. Keep all production flags off and parity boxes unchecked. Dedicated instruction-list resizing, legacy Practice conversion and deliberate Knowledge/Milestone draft actions remain tracked inventory work; full History interaction is Batch 4b.

Use small context-specific Create a Revision actions and one dated, change-labeled disclosure per saved scope. A header snapshot must not create independent duplicate History records for every descendant, and no revision automatically creates a project milestone. Required acceptance will cover nested step order and attachment retention, unchanged part revision, fixed earlier snapshots after edits, cancel/no-op/stale draft/lost-response behavior, and export/restore of the independent scope versions.

## PR #53 review decision: design identity and evidence context

The owner delegated these choices after Claude's review of e341f995f88584d6eaffa68c763ef467949842cd. A configuration identifies normalized saved part details and the exact engineering-file identity/bytes. Occurrence quantity/unit, build status, attention/note, tree visibility and the project name are operational context; they do not create a different design configuration. Part revision numbers remain deliberate checkpoints and need not map one-to-one to design configuration IDs.

New configurations use snapshot format 2 without occurrence/project fields. Each new record captures build/project context server-side in its immutable creation event payload (record_context), linked by its stable record ID. Revision/file events retain before/after build_context independently of their design references. Replay remains before current revision/context checks. History shows the captured context separately from the design.

Existing format-1 snapshots, fingerprints, IDs and evidence links are never rewritten or deduplicated. Their build information remains readable as legacy captured context. The first new capture after an old-format design can create one format-2 identity; this explicit boundary preserves old evidence. New/legacy snapshots and context round-trip through the existing backup tables without rewriting applied migrations. #65/#66 must carry this identity/context separation forward while keeping full part/assembly revision snapshots complete.

### Remaining cutover gates from that review

- Record edits now create a single guarded Record edited event with immutable before/after text, type, title, date and attachment identities, actor/time, stable record ID and original tested configuration/context. Removed/replaced attachments remain linked to the audit. No-op/cancel/rejected writes create no audit; exact retries replay one event. Audit views display their saved values rather than mutable current record text and appear under Changes. Creation-event and Knowledge mappings stay unique through the separate edited_record_id payload key. New and legacy capture contexts and file bytes round-trip through recovery. This is implemented on the PR #53 follow-up and still needs exact-head CI/review; it is not a production cutover claim.
- Restore as a copy is implemented as the normal gated UI workflow: require a new project name/UUID, preserve scoped child identities and immutable snapshot JSON, and publish all rows under the new project after byte verification. Target-project/operation storage keys isolate files. Original build/project capture context remains historical; it is not relabeled as the recovered project's context. Same-database copies leave source metadata/bytes unchanged, exact retries reuse the original receipt, altered operation content/existing targets are refused, and corrupt/truncated backups cannot publish metadata. The original-identity independent-target import remains supported for operator proofs. This implementation requires fresh exact-head CI/review before integration, and large platform restore capacity is still a separate gate.
- Validate representative large restores on actual Cloudflare, not just local SQL. Finding F's staged importer now seals metadata, loads actual rows in bounded batches under a hidden project marker and atomically publishes only a verified complete copy (migration 6). Its 100,000-row/256 MB resource guards are not proven operational capacity. A 3,000-record plus drawing regression exceeds the former 10,000-row/16 MB limits and verifies every historical revision after copy recovery. Obtain targeted review of the new visibility/admission boundary, then measure full restore, final validation, memory and invocation queries before setting production capacity. Do not mark recovery ready from local fixtures alone. The token/control-plane and large-restore platform gates remain pending.

### #65 compatibility implementation

Numbered full-part checkpoints retain their own part/build/counter plus instruction and evidence context, while format-2 design identities exclude operational state and the checkpoint counter. New full copies use snapshot format 3 with current records, their immutable creation/edit events and attachment ownership, preserving each test's original context and audit values. Do not recursively embed prior complete part-revision payloads. Older full snapshots/configurations remain readable, and copying a project must not rewrite historical JSON.

The engine UI now follows the latest single dated/change-labeled disclosure preference, with saved counts and working-level metadata, instead of its earlier duplicate table. Existing legacy presentation remains intact. This is implementation on the queued #65 branch, subject to exact-head CI/review and #53 integration; it does not activate or accept the production replacement.

### Required #66 reconciliation checks

The tested part counter is per-record context, not design identity; preserve it through audits and full snapshots. For shared placements, require and capture the exact placement. Carry the same design/context separation through Workshop selections and recursive assemblies instead of reverting to older combined fingerprints.

Assembly design includes the logical component structure, component quantities/units and exact child designs. Outer build quantity, build statuses/attention/visibility, project labels and checkpoint counters remain captured context. Equivalent copies of a shared assembly must not create different designs only because their placement IDs or display ordering differ. Preserve actual placement IDs, paths/order and build states in the fixed test/full-part context, separate from a canonical design projection. Changing a component count, selected product or child design must change the assembly design. Add targeted tests for both sides of that boundary and copy recovery before declaring #66 reconciled.

Large restore acceptance must measure complete batches against [Cloudflare's documented D1 limits](https://developers.cloudflare.com/d1/platform/limits/), including the entire batch duration. A batch counts once against the per-invocation query count; local SQLite timing does not prove the platform bound. Measure 2,000 / 5,000 / 10,000 inserts and the first large frozen-value revision (Finding G), then 3,000- and 10,000-record staged export/recovery including CPU/wall time, final publication, completed-staging cleanup and the new activity checkpoints. G still uses one guarded frozen-value batch. Phase-1 DB rows survive retries under the same job; full input parsing/hashing repeats, so this does not prove a bounded multi-request CPU protocol. Completed staging cleanup, read-only inventory and restore-side activity/retirement claims are implemented in the common cleanup owner. Migration 7 grants a fresh upgrade grace period, refreshes progress and permanently fences claimed owner/target/operations, including through database backstops. Claims and the new migration-8 private-copy executor are internal only; no HTTP claim/apply or cron caller exists. The executor journals exact restored target/operation file keys before deleting private D1 rows in bounded, resumable batches; permanent jobs/key tombstones survive. Storage writers check fences around puts and triggers block retired-key admission. It deletes no R2 bytes or published/source metadata. Inventory preserves references and protects recent/unknown progress, published/foreign targets and receipts. Migration 9 adds an internal retired-restore storage companion with global engine/staged/catalogue reference checks, permanent per-ETag deletion intents/reference fences, object-age/identity rechecks and bounded exact-key pages. No public/cron caller exists. Additional upload/Workshop/frozen-value cleanup is deferred under the schema-9 freeze; compatible deployed readers/writers and actual platform proof are still required. See PREVIEW_ACCEPTANCE.md for executor limits and late in-flight-put handling. The technical 100-placement Archive guard is shown before a request; smaller child groups are recommended, with owner acceptance (K) recorded on November 24. E1's padded-number concurrency regression exists; browser recovery verifies E3 download links use the copy. E4's single validated migration entry, read-only Workshop readiness, concurrent migration retry and command schema guard are implemented. Exact-head review/CI, actual bindings, compatible deployed readers/writers and owner inventory sign-off remain cutover gates.
