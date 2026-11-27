# BuildingSchmidt — current status

November 27, 2026. One private owner application on Cloudflare Workers, D1 and R2. The latest deployed baseline is #142 (`b99fab06326e9e37f632af2eb5a3991899006344`): Lessons Learned and shared ordered project photos. Production Worker version at that release: `a93bf427-1b59-4ea7-96d4-f8f927745cf7`.

## Current behavior

- Projects uses guarded commands, stable item/placement identities, immutable history/files, revision checks, independent Workshop copies, exports and restores. The retired R2 application is gone. The owner waived the old trial/backup gate for source retirement; production storage was not purged.
- New part uses the approved editor, supplier and individual/package cost fields, shared Tool/Part storage and Ordered status. Existing shared placements and typed historical values remain supported.
- Lessons Learned replaces the Info Bits tile editor at `knowledge.html`, with calculators retained. Autosave serializes writes and preserves operation identity/drafts; links survive renaming; archive/restore and step photos are available. Old tile/link rows remain in backup storage.
- Project summaries, parts and subassemblies use one ordered gallery: photo 1 is main; a newly mounted viewer starts at 1; ordering uses drag or earlier/later controls. Status/Quantity sit above the separate photo frame. Workshop keeps single-cover behavior; lesson steps have no main slot. Done uses the primary shared style.
- The scheduled job produces changed-project backups. Whole-site export/recovery includes Workshop, Lessons, account data and stored files; it is currently manual. Native local Cloudflare recovery is tested; hosted production-snapshot recovery has not been performed.

## Current work

Ryan authorized combining the two whole-site reviews and starting implementation. See [the combined evaluation and work plan](WHOLE-SITE-REVIEW-2026-11-27.md) for every finding, agreed priority and acceptance boundary.

Batch 1 candidate formats compressed project modules, retires the unused tile runtime and live proof tools, removes the obsolete Projects variable and unused helpers, replaces the empty route-regex guard with a declared dispatch registry, and reconciles documentation. Proof/recovery workflows remain in the disposable test environment. Release validation and deployment evidence belong on its PR; this page does not claim the unmerged candidate is live.

Queued owner UI additions: faster photo reordering with immediate activity feedback, a visually grouped What happened field, and removal of the persistent idle Saved strip. Details and acceptance are in the combined plan. These do not interrupt the cleanup candidate.

Next: automatic whole-site recovery coverage and visible failure status; isolated toolchain/advisory maintenance; login attempt limiting. Then consistent errors/save/upload lifecycle rules and tested browser headers. Image/read optimization follows measurements.

## Working boundaries

Preserve the current owner/origin guards, project/Workshop isolation, immutable evidence, operation replay, deletion tombstones and restore fences. Applied migrations and current backup readers remain. No stored-data sweep, account change or paid AI test is part of this cleanup. Routine Claude reviews remain off. Existing historical draft PRs #32 and #91 are not active implementation work and must not be merged automatically.

[CODEBASE_GUIDE.md](CODEBASE_GUIDE.md) owns the code map; [UI_STANDARDS.md](UI_STANDARDS.md) owns current component behavior. Dated rollout, proof and batch documents are preserved under [history/](history/README.md); they do not override current instructions. Independent hosted URLs remain late priority.
