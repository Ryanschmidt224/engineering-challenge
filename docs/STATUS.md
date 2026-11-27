# BuildingSchmidt — current status

November 27, 2026. One private owner application on Cloudflare Workers, D1 and R2. The confirmed release baseline is #153 (`35e09f4531cd66ef51269c8e1778015ee9cf0dcd`): the compact Workshop product read view, shared confirmation template (#152), default-collapsed family fields (#151), and the earlier Lessons/photo/lookup updates. Its 290 code tests, 143 browser workflows and dependency check passed. Release PRs record exact source and Cloudflare deployment evidence.

## Current behavior

- Projects uses guarded commands, stable identities, immutable history/files, revision checks, independent Workshop copies and tested export/restore. The retired application and availability flag are gone; stored historical data remains.
- Workshop uses families and products. Family fields start collapsed; products remain prominent in the existing navigation. AI lookup requires a search hint, searches supported product attachments, and keeps source evidence with applied values. Read specifications use compact rows and quiet source disclosures.
- Lessons Learned supports autosave, rename-safe links, archive/restore and step photos. Its editor and read view share the framed field layout. The old Info Bits runtime is retired, with old rows retained in exports.
- Projects use ordered photo galleries with immediate reorder feedback and full-screen cycling. Workshop keeps a single cover, and lesson steps have no cover slot.
- Archive, restore, discard, guarded save and permanent-delete confirmations share the centered template. Existing revision, retry and typed-name safeguards remain.
- The nightly job backs up changed Projects to the same R2 bucket. Whole-site export/recovery includes Projects, Workshop, Lessons, account data and stored files; that complete export is currently manual. Native local Cloudflare recovery is tested; hosted production-snapshot recovery has not been performed.

## Reliability work

The backup-monitoring candidate adds a bounded, conditionally written status record for the existing nightly job. Website settings shows the last attempt, last successful check, failures, interrupted runs and overdue checks. Unchanged project archives are checked for completeness before being reported successful. The page and Workshop export help explicitly distinguish project-only, Workshop-only and whole-site coverage. The candidate's release PR owns validation and publication evidence; it does not claim that a production cron has already fired.

Next is automatic whole-site recovery coverage: bounded, nonrecursive storage, verified content and restore behavior after Workshop-only or lesson-only changes. An independently stored recovery copy and deployment configuration remain separate requirements. Then durable login-attempt limiting, consistent save/upload/error lifecycle rules, and tested browser security headers. Optimize photos and larger collection reads after measurement.

The complete finding/action list is in [the combined review and work plan](WHOLE-SITE-REVIEW-2026-11-27.md). Cleanup #143, toolchain maintenance #144 and photo/lesson feedback #145 are released. Dependency advisories are checked in CI; automatic dependency PRs require normal review and tests.

## Working boundaries

Preserve owner/origin guards, project/Workshop isolation, immutable evidence, operation replay, deletion tombstones and restore fences. Applied migrations and current backup readers remain. No stored-data sweep, account change or paid AI test is part of this maintenance. Routine Claude reviews remain off. Historical draft PRs #32 and #91 are not active work and must not be merged automatically.

CAD attachments are queued for a Dropbox-link workflow; access and editing behavior are undecided. Existing CAD files/upload behavior remain. Independent hosted project URLs stay a late priority.

[CODEBASE_GUIDE.md](CODEBASE_GUIDE.md) owns the code map; [UI_STANDARDS.md](UI_STANDARDS.md) owns current component behavior. Dated reports live in [history/](history/README.md).
