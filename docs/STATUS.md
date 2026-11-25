# Building Schmidt — current status

Current state and next step only. Keep at most three lines per PR; no release history or dated handoffs. Feature behavior lives in HISTORY_REWRITE_PLAN.md, retained scope in FEATURE_INVENTORY.md, and deferred items in FOLLOWUPS.md.

## Current

Production follows main; its exact head/build is tracked by GitHub deployment checks. NEW_PROJECT_ENGINE remains off in production and enabled only for previews. No real data, files or backups are deleted or overwritten.

- Batch 4b / `feature/project-history-screens`: History filters, paging, saved/working comparisons, navigation/selection/scroll and read retries; Claude's Q flaky wait is corrected. Frontend/display/test/docs only; no table, migration, backup or save-guard changes.
- Focused History/workspace flows pass; exact full local/CI results and merge head belong in the single Batch 4b PR. Source starts directly from current main; no stacked PR.
- Next: merge 4b once Node, browser and preview checks pass under the owner's screen-only policy; coordinate sole Batch 5 writer ownership with Claude's feature map before implementing its Keep/Rebuild scope.

## Owner delivery policy

- Target: new project pages ready for a switch-over decision in about five working days; readiness is not activation.
- Order: 4a → 4b → 5, one PR per batch, each starting from latest main after the previous one merges.
- Screen, wording, layout, editor and History-display changes may self-merge after Node, browser and Cloudflare preview checks pass; data tables/migrations, backup/restore and guarded-save changes still wait for Claude review. Fix later screen-review findings in the next PR.
- Build the plainest working version. No optional hardening or rare-race work; record a one-line follow-up and move on. Preserve existing tests; add one success test per feature and one main stale-save/duplicate-submit failure case.
- If a task runs about two hours beyond expectation, stop and report the blocker, simplest route and what that route gives up; do not design around it without the owner.
- Batch 5 is limited to FEATURE_INVENTORY Keep/Rebuild scope. Ask before adding anything unlisted.
- Backup/recovery design stays frozen at schema 9: bug fixes only. Claude approved the additive instruction metadata compatibility in merged 4a; it adds no recovery or cleanup mechanism. Never expose passwords, cookies or tokens in chat, files or logs.

## After 4a, 4b and 5 merge

Give the owner one consolidated list: real-Cloudflare timing/binding acceptance, the 100-placement archive-limit sign-off, and feature-checklist acceptance. Then prepare Batch 6's exact data-disposition/backup evidence for approval. Keep all real data, R2 files and backups; switch-over requires separate explicit approval.
