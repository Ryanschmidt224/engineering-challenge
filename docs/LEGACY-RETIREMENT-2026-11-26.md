# Legacy application retirement — November 26, 2026

The owner waived the backup/trial gate and authorized removal of all retired application work, accepting data loss if needed. The implementation removes the runtime dependencies; it does not require a production data reset or storage sweep.

## Removed

- Retired HTML application, browser controllers, R2 project API handlers, assembly/component editors and override stylesheets. The old index is a small redirect; retired APIs return protected 410 responses with no data handlers.
- Old weekly legacy backups and obsolete rollout/owner-setup/capacity/deletion-proof tooling. Current changed-project nightly backups, current command proofs and native recovery tests remain.
- Legacy Workshop use editors and R2 project projections, the legacy AI lookup prompt/result contract and automatic supplier-number guessing. Current template-only lookup preserves spending/quota, owner/origin boundaries, typed fields, source evidence and explicit review/save.
- The old annotation API client that had no current UI caller. Native clipboard selection is a small storage-independent module; current photo tools and file uploads retain their owning persistence. Shared helper imports no longer bootstrap UI at import time.
- Tests solely for the removed application. Current owner, backup/restore, deletion, stale-write, evidence, media and UI workflows remain, with new retirement and current Info Bits link regressions.

## Reconnected current features

One Account dialog works on every current page, reusing existing credentials/session formats. Current project pages retain draft-preserving reauthentication callbacks. Settings HTML is explicitly Worker-first in the deployment configuration. No sign-in or account data is migrated.

Info Bits now selects current projects, scoped parts and records. Resolution checks the current project owner and excludes deletion/restore staging. It batches target queries to stay within D1 bind limits. Old unresolved targets keep their saved labels and report missing; no guessed mapping is made. Direct record links reveal the current record within its current project.

Current project and calculator directories receive explicit covers; the removed `/api/photos` fallback and legacy photo-change event are gone. Photo controls use named modules and the shared button constructor. Applied migrations and stable current archive formats remain because deleting upgrade history or format readers would break existing databases and downloaded backups.

## Validation and boundaries

Final code/browser counts and exact deployment evidence are recorded on the release PR. Checks include the real local Cloudflare D1/R2 full restore, current project recovery UI, private/origin guards, immutable evidence, pending document handling, calculators, Workshop and responsive navigation. Test fixtures now dispose a database only after its in-flight responses finish, rather than closing it during a reset.

No paid AI call, production project deletion, database row purge, R2 sweep, secret change or account change was performed for validation. Existing stored legacy bytes remain opaque archival data; the retired application cannot read or update them, and its scheduled backups no longer run. The current application remains the source of truth.
