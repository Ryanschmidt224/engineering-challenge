# Building Schmidt — current status

Current state and next step only. Keep at most three lines per PR; no dated handoffs. Behavior: HISTORY_REWRITE_PLAN.md; retained scope: FEATURE_INVENTORY.md; deferred items: FOLLOWUPS.md.

## Current

Production follows main; its exact head/build is tracked by GitHub deployment checks. The owner has approved production switch-over; that approval is retained and must not be requested again. NEW_PROJECT_ENGINE remains off while integration, legacy read-only preservation and required acceptance checks are completed. No real data, files or backups are deleted or overwritten.

- #75, #76 and #77 merged after Claude review and passing checks; latest main is `f1a4eb7`. The read-only boundary, media/daily backups and manual operator workflow are integrated. Live capacity execution and production activation have not been performed.
- Manual custom-part source/recovery/unchanged-source checks passed for `8fedb3e8-de11-4f59-b81d-80227372a6a9`; exact reports/builds and owner-checked binding names are in proofs/PROJECT_CUTOVER_ACCEPTANCE.json. Secure operator access and actual scripted capacity/CPU/SQL/trigger-state measurements remain pending; the owner accepted the Archive limit and approved activation.
- `feature/project-backup-settings`: collapsed Automatic backups list/downloads, empty/loading/error states and retry are implemented; downloading preserves the settings draft. UI validation passed 421 Node and 164 browser checks before integrating #77; combined checks/CI are next. Merge under the screen-only rule once green; production stays off until readiness passes.

## Early switch-over policy

- Pre-switch order: 4b and 5a (merged), then Claude's combined v3 media/backups integration requested in issue #74, then switch-over readiness work. Later Batch 5 groups wait for the owner's requested order; do not create stacked feature PRs.
- Nightly: the existing cron calls the existing engine export for changed projects; append-only .bsproject objects under automatic-backups/engine/. Claude's reviewed schema uses engine_media with photo/picture roles in the API; later file roles are reserved in its CHECK only. Existing engine_file_links remain unchanged; no files/drawings/code feature work is added.
- Legacy pages/data stay in place, read-only; new work goes to the engine. No deletion, import or mandatory project migration. Moving individual legacy projects is a separate optional later job. The server-enforced legacy read-only boundary has Claude approval; its deployed verification remains required before activation.
- The owner plans a project-data clean-out after handoff. Treat that as a separate later operation with exact projects/storage/backups scope confirmed then; retain all current source/proof data during acceptance.
- Screen, wording, layout, editor and History-display changes may self-merge after Node, browser and Cloudflare preview checks pass; data tables/migrations, backup/restore and guarded-save changes still wait for Claude review. Fix later screen-review findings in the next PR.
- Build the plainest working version. No optional hardening or rare-race work; record a one-line follow-up and move on. Preserve existing tests; add one success test per feature and one main stale-save/duplicate-submit failure case.
- If a task runs about two hours beyond expectation, stop and report the blocker, simplest route and what that route gives up; do not design around it without the owner.
- Batch 5 is limited to FEATURE_INVENTORY Keep/Rebuild scope. Ask before adding anything unlisted.
- Backup/recovery design stays frozen at schema 9: bug fixes only. Claude approved the additive instruction metadata compatibility in merged 4a; it adds no recovery or cleanup mechanism. Never expose passwords, cookies or tokens in chat, files or logs.

## Switch-over approval package

After the reduced prerequisites merge, provide one list: real-Cloudflare timing/acceptance run; the accepted 100-placement Archive rule; confirmation legacy pages are read-only and nothing was deleted. Tell the owner when to sign in for that run. Prepare and validate the exact activation change using the owner's already-granted switch-over approval. Do not request the Archive decision or activation approval again, and do not treat approval as a waiver of required code reviews or readiness checks.
