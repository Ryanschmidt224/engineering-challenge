# Building Schmidt — current status

## November 26, 2026: legacy application retirement

The owner explicitly waived the nightly-backup and 1–2 week trial hold, stated that existing data is not valuable, and authorized removal of the retired application. This supersedes the earlier removal prerequisite. Routine Claude reviews remain off.

The site now has one current D1 project application. `/` and the previous index open Projects. Account, Workshop, Info Bits, calculators, settings, current files, numbered revisions, history, exports and restores use their current implementations. Retired project APIs return an owner-protected `410 LEGACY_RETIRED`; they cannot read or mutate old project data. The old weekly legacy backup job is removed; current changed-project nightly backups remain.

- #131–#134 released: durable AI evidence and upload recovery, pending-only Forget unconfirmed document, code/status cleanup, settings refresh, direct navigation state and shared photo layout.
- The retirement removes the old browser controllers, R2 project handlers, override stylesheets, legacy AI result contract, obsolete acceptance tools and tests solely for those features.
- Shared Account UI opens on the current page. Existing owner accounts, password hashes, cookies, authorization rules and draft-preserving reauthentication remain. Website settings HTML explicitly runs through the Worker guard in production configuration.
- Info Bits project/part/record links resolve current project IDs and owner scope. Old unresolvable targets keep their labels and report missing; they are not guessed or remapped.
- Clipboard selection is a small storage-independent module. Shared photo tools use current controls; the unused legacy annotation API client is removed. Existing current photo upload/replacement, captioning, ordering, file/history and viewing remain.
- Applied database migrations, stable current backup formats, frozen project evidence and current deletion/restore fences remain. This code retirement does not purge existing R2 objects or database rows, rewrite history or change accounts.
- All release evidence and final test counts are recorded on the retirement PR. The local full D1/R2 restore remains part of code checks. Actual downloaded nightly-backup verification is still useful operational evidence, but is no longer an owner-imposed removal gate.

## Boundaries and next work

Keep the current project data paths, private owner boundary, project/Workshop isolation, immutable evidence and checked backup/restore protocols. No paid AI acceptance calls or production data sweeps are part of the retirement validation. Cloudflare Paid, the production/isolated-preview bindings, API settings and cron cadence stay in place. The project-engine availability switch can disable Projects; it no longer selects a legacy fallback.

The broader audit remains tracked in [AUDIT-FOLLOWUPS-2026-11-26.md](AUDIT-FOLLOWUPS-2026-11-26.md). The Workshop layout redesign is a future upgrade; independently hosted URLs remain late priority. Deferred optimization PR #91 requires reevaluation against the retired codebase before any later work. Do not automatically merge it.

See [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md), [LEGACY-RETIREMENT-2026-11-26.md](LEGACY-RETIREMENT-2026-11-26.md) and the clearly labeled historical documents under `docs/history/`. Historical checkpoints do not override the current owner instruction.

## Approved New part editor — release candidate

The approved mockup replaces competing custom/placement creation choices with New part. Identity orders Parent subassembly, Item type, Part source, Part Name (Generic), Purpose, then automatic numbering. Tool uses the existing part/tool contract; documents and code hide sourcing. Purchased records retain supplier/ordering and separate USD individual/package costs. Workshop copying remains available under Purchased; Duplicate part still creates an independent copy. Existing shared placements are not silently converted or deleted.

Specific-name and description rows hide when names are linked, preserving draft values and stored descriptions. Blank prompt/details rows use stable specification IDs without presets or panels; existing typed specification evidence and units remain compatible. Acceptance criteria is removed from the working editor, while stored historical data remains readable through archives. Ordered is supported by model, API, status controls, filters, backups and an atomic v16 occurrence-constraint migration preserving rows, foreign keys, indexes and triggers. Shared editors scroll their content above a persistent action bar. The four approved help controls use the shared tooltip owner.

Validation and deployment evidence will be recorded on the release PR. No production data purge or paid AI lookup is part of this release.

## Approved part photo layout

Part pages now place the identity heading first, the photo component next, and compact Status, Quantity and Needs attention controls below it. The expanded component follows the approved mockup: a main-photo slot beside three-column library tiles, one upload/paste area, and a top-right Done control. Phone layouts stack the same regions. Caption editing and confirmed removal remain available through the simplified tiles.

Previous/next buttons, a position counter and left/right keyboard navigation browse existing photos without issuing a command or changing the saved main picture. Explicit Use as main or library dragging selects that picture; clearing or replacing it keeps library files. The component handles zero/one-photo navigation and legacy main pictures that have no separate library row. Browser checks cover desktop/phone geometry, wraparound, read-only browsing, persistence after reload, captions/removal, existing uploads and failure feedback. Release checks and deployment evidence are recorded on the PR.

## Lessons Learned and ordered photos — approved release

The owner approved the supplied notebook design, autosave with a visible saving indicator, and archive/restore. Lessons Learned replaces the Info Bits tile editor while retaining the existing `knowledge.html` URL and collapsed calculators. It starts fresh as explicitly authorized: old tile rows are not imported or purged. The old Workshop tile-creation UI is removed. The existing backup-compatible tile API/model remain a bounded compatibility surface, not a second notebook editor.

The additive Workshop migration v5 creates lessons and photo metadata. Save retries retain an operation ID and payload hash; photo archiving checks the unique winning operation instead of timestamps. Drafts survive conflicts, lost responses and same-tab reloads; edits are serialized without replacing the typing form. Title aliases keep existing lesson links working after renames. Archive/restore is available in the page.

Project summaries, parts and subassemblies share an ordered gallery. Drag/drop or accessible earlier/later buttons determine order; photo 1 is main and a newly mounted viewer starts at 1. Done uses the shared primary button style. Viewer captions/instructions are removed; filenames/captions remain editable in the library. Build controls appear in the identity frame above the separate photo frame. Old standalone pictures remain accessible and are adopted without reupload on reorder. Workshop keeps its single-cover semantics and uses the shared prominent Done control; lesson steps share upload/paste/progress controls without a cover slot.

Validation includes native whole-site D1/R2 backup and reconstruction with lesson text, steps and actual photo bytes. Release checks and production deployment evidence are recorded on the PR.
