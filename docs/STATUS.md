# BuildingSchmidt — current status

November 27, 2026. One private owner application on Cloudflare Workers, D1 and R2. The confirmed release baseline is #155 (`66a613b2fe75f02a286b8437d2d117a75fdb85f3`): automatic whole-site backups, backup monitoring, the compact Workshop product read view, shared confirmation template (#152), default-collapsed family fields (#151), and the earlier Lessons/photo/lookup updates. Its 313 code tests, 148 browser workflows and dependency check passed. Release PRs record exact source and Cloudflare deployment evidence.

## Current behavior

- Projects uses guarded commands, stable identities, immutable history/files, revision checks, independent Workshop copies and tested export/restore. The retired application and availability flag are gone; stored historical data remains.
- Workshop uses families and products. Family fields start collapsed; products remain prominent in the existing navigation. AI lookup requires a search hint, searches supported product attachments, and keeps source evidence with applied values. Read specifications use compact rows and quiet source disclosures.
- Saved Workshop products expose a Photos section in view and edit mode, with the shared choose/drop/paste controls and immediate photo saves. Upload retries reuse their identity; failed list refreshes do not reupload saved photos. Other product edits remain unsaved until Save product.
- Lessons Learned supports autosave, rename-safe links, archive/restore and step photos. Its editor and read view share the framed field layout. The old Info Bits runtime is retired, with old rows retained in exports.
- Projects use ordered photo galleries with immediate reorder feedback and full-screen cycling. Workshop keeps a single cover, and lesson steps have no cover slot.
- Archive, restore, discard, guarded save and permanent-delete confirmations share the centered template. Existing revision, retry and typed-name safeguards remain.
- The nightly job retains per-project archives and now has a whole-site recovery writer, covering Projects, Workshop, Lessons, account data and stored files without recursively copying earlier backups. It keeps seven verified copies, with bounded streaming and tracked interrupted-upload cleanup. Manual whole-site download remains available. Native local Cloudflare recovery is tested; hosted production-snapshot recovery has not been performed.

## Reliability work

Backup monitoring (#154) adds a bounded, conditionally written status record for the existing nightly job. Website settings shows the last attempt, last successful check, failures, interrupted runs and overdue checks. Unchanged project archives are checked for completeness before being reported successful. The page and Workshop export help explicitly distinguish project-only, Workshop-only and whole-site coverage. Its release PR records publication evidence; it does not claim that a production cron has already fired.

The [automatic whole-site backup implementation](AUTOMATIC-SITE-BACKUPS.md) follows: verified download list, seven-copy retention, consistency checks, bounded streaming, recovery from terminated multipart uploads, and an independent native restore after Workshop-only/notebook-only changes. Its release PR owns validation/deployment evidence. Owner-independent storage and hosted production-snapshot recovery have not been performed.

Next: durable login-attempt limiting. Then consistent save/upload/error lifecycle rules and tested browser security headers. Optimize photos and larger collection reads after measurement.

The complete finding/action list is in [the combined review and work plan](WHOLE-SITE-REVIEW-2026-11-27.md). Cleanup #143, toolchain maintenance #144 and photo/lesson feedback #145 are released. Dependency advisories are checked in CI; automatic dependency PRs require normal review and tests.

## Working boundaries

Preserve owner/origin guards, project/Workshop isolation, immutable evidence, operation replay, deletion tombstones and restore fences. Applied migrations and current backup readers remain. No stored-data sweep, account change or paid AI test is part of this maintenance. Routine Claude reviews remain off. Historical draft PRs #32 and #91 are not active work and must not be merged automatically.

CAD attachments are queued for a Dropbox-link workflow; access and editing behavior are undecided. Existing CAD files/upload behavior remain. Independent hosted project URLs stay a late priority.

[CODEBASE_GUIDE.md](CODEBASE_GUIDE.md) owns the code map; [UI_STANDARDS.md](UI_STANDARDS.md) owns current component behavior. Dated reports live in [history/](history/README.md).
