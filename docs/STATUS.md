# Building Schmidt — current status

Current state and next step only. Keep at most three lines per PR; no dated handoffs. Behavior: HISTORY_REWRITE_PLAN.md; retained scope: FEATURE_INVENTORY.md; deferred items: FOLLOWUPS.md.

## Current

Production follows main; its exact head/build is tracked by GitHub deployment checks. NEW_PROJECT_ENGINE remains off in production and enabled only for previews. No real data, files or backups are deleted or overwritten.

- Batch 5a / #73, from main after merged 4b: brief-reconciled directory/sign-in, numbering previews, tree filters, read-only Parts Management with existing editors, BOM/Tools/grouping, instruction-list resizing, reviewed Workshop-copy drafts and readable HTML with a separate Archive heading.
- Supplied Claude brief, feature map and historical disposition source map are retained in docs; later owner scope overrides their older sequencing. The signed-out page stays 401 with a static sign-in shell; no API owner checks, tables, migrations, backup protocol or save guards change. Exact head/check evidence belongs in #73.
- Next: finish #73 checks, then separate latest-main PRs for nightly engine backups (Claude review) and project/part photos only (Claude review). No stacked feature PR.

## Early switch-over policy

- Pre-switch order: 4b (merged) → 5a screens → nightly engine backups → project photos/part pictures. Each PR starts after the previous merges. Later Batch 5 groups wait for the owner's requested order.
- Nightly: existing cron calls existing engine export; one .bsproject per project under automatic-backups/. No restore/recovery changes. Photos: brief's engine_item_files table, only project_photo, part_picture and photo roles, existing markup/viewer; no files/drawings/code feature work.
- Legacy pages/data stay in place, read-only; new work goes to the engine. No deletion, import or mandatory project migration. Moving individual legacy projects is a separate optional later job. Server-enforced legacy read-only behavior still needs implementation/verification before approval.
- Screen, wording, layout, editor and History-display changes may self-merge after Node, browser and Cloudflare preview checks pass; data tables/migrations, backup/restore and guarded-save changes still wait for Claude review. Fix later screen-review findings in the next PR.
- Build the plainest working version. No optional hardening or rare-race work; record a one-line follow-up and move on. Preserve existing tests; add one success test per feature and one main stale-save/duplicate-submit failure case.
- If a task runs about two hours beyond expectation, stop and report the blocker, simplest route and what that route gives up; do not design around it without the owner.
- Batch 5 is limited to FEATURE_INVENTORY Keep/Rebuild scope. Ask before adding anything unlisted.
- Backup/recovery design stays frozen at schema 9: bug fixes only. Claude approved the additive instruction metadata compatibility in merged 4a; it adds no recovery or cleanup mechanism. Never expose passwords, cookies or tokens in chat, files or logs.

## Switch-over approval package

After the reduced prerequisites merge, give the owner one list: real-Cloudflare timing/acceptance run; 100-placement Archive rule sign-off; confirmation legacy pages are read-only and nothing was deleted. Prepare the exact activation change for approval; do not enable production beforehand.
