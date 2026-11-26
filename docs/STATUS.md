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
