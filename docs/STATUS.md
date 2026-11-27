# BuildingSchmidt — current status

November 27, 2026. One private owner application on Cloudflare Workers, D1 and R2. Latest confirmed deployed baseline: #150 (`d0b00de575cc3cd2f7b7c9cad23ac1031ce846b1`), including the Lessons editor/view frames (#147–149), automatic-attachment AI lookup, summary details expansion and full-screen photo navigation. Production build `dbfc60bc-d9ab-4bb0-9489-9d7cb3b06957`, Worker `d24b74a0-988b-4158-a581-9d9fc18efaef`, and exact live browser assets were verified. The candidate passed 290 code tests, 137 browser workflows and dependency audit with zero known vulnerabilities.

The approved Workshop follow-up groups About this family and Fields inside a default-collapsed Family and fields section and adds the named archive dialog with the approved explanation, explicit Archive family confirmation and Cancel focus. Its PR records validation and publication state. Existing columns, product buttons and archive storage semantics stay intact.

## Current behavior

- Projects uses guarded commands, stable item/placement identities, immutable history/files, revision checks, independent Workshop copies, exports and restores. The retired R2 application is gone. The owner waived the old trial/backup gate for source retirement; production storage was not purged.
- New part uses the approved editor, supplier and individual/package cost fields, shared Tool/Part storage and Ordered status. Existing shared placements and typed historical values remain supported.
- Lessons Learned replaces the Info Bits tile editor at `knowledge.html`, with calculators retained. Autosave serializes writes and preserves operation identity/drafts; links survive renaming; archive/restore and step photos are available. Old tile/link rows remain in backup storage.
- Project summaries, parts and subassemblies use one ordered gallery: photo 1 is main; a newly mounted viewer starts at 1; ordering uses drag or earlier/later controls. Status/Quantity sit above the separate photo frame. Workshop keeps single-cover behavior; lesson steps have no main slot. Done uses the primary shared style.
- The scheduled job produces changed-project backups. Whole-site export/recovery includes Workshop, Lessons, account data and stored files; it is currently manual. Native local Cloudflare recovery is tested; hosted production-snapshot recovery has not been performed.

## Current work

Ryan authorized combining the two whole-site reviews and starting implementation. See [the combined evaluation and work plan](WHOLE-SITE-REVIEW-2026-11-27.md) for every finding, agreed priority and acceptance boundary.

Batch 1 in [PR #143](https://github.com/Ryanschmidt224/engineering-challenge/pull/143) formats compressed project modules, retires the unused tile runtime and live proof tools, removes the obsolete Projects variable and unused helpers, replaces the empty route-regex guard with a declared dispatch registry, and reconciles documentation. Proof/recovery workflows remain in the disposable test environment. The release PR records exact-head validation, merge and production deployment evidence; use that checkpoint to distinguish checked source from a confirmed live release. Local validation passed all 289 code checks and native D1/R2 recovery; all 133 browser workflows and Cloudflare preview also passed on the final head. The batch is released with the owner’s explicit approval.

The [photo/lesson feedback change](PHOTO-LESSON-FEEDBACK-2026-11-27.md) implements the three owner additions: immediate reorder feedback with an in-place confirmed update, a framed What happened field, and no persistent idle Saved strip. It is released as #145. The owner’s next styling request aligns the Lessons Learned editor with Edit part details: shared shaded section bands, compact paired labels and bordered inputs, stacking on phones. The styling PR records its validation/publication checkpoint; persistence and autosave rules stay the same.

[Toolchain maintenance](TOOLCHAIN-MAINTENANCE-2026-11-27.md) addresses the two reviewed transitive advisory ranges, maintained CI actions and weekly dependency update PRs. The owner authorized full npm audit; the updated lockfile reports zero known vulnerabilities, and CI explicitly rejects high/critical advisories. Release evidence is recorded on its PR.

Next: automatic whole-site recovery coverage and visible failure status; login attempt limiting. Then consistent errors/save/upload lifecycle rules and tested browser headers. Image/read optimization follows measurements.

## Working boundaries

Preserve the current owner/origin guards, project/Workshop isolation, immutable evidence, operation replay, deletion tombstones and restore fences. Applied migrations and current backup readers remain. No stored-data sweep, account change or paid AI test is part of this cleanup. Routine Claude reviews remain off. Existing historical draft PRs #32 and #91 are not active implementation work and must not be merged automatically.

[CODEBASE_GUIDE.md](CODEBASE_GUIDE.md) owns the code map; [UI_STANDARDS.md](UI_STANDARDS.md) owns current component behavior. Dated rollout, proof and batch documents are preserved under [history/](history/README.md); they do not override current instructions. Independent hosted URLs remain late priority.
