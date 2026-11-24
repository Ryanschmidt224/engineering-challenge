# Building Schmidt — current status

Current state and next step only. Keep at most three lines per PR; no release history or dated handoffs. Feature behavior lives in HISTORY_REWRITE_PLAN.md, retained scope in FEATURE_INVENTORY.md, and deferred items in FOLLOWUPS.md.

## Current

Production main: `fe3a10788b3896d37e663494a1c223c58014ed54`. NEW_PROJECT_ENGINE remains off in production and enabled only for previews. No real data, files or backups are deleted or overwritten.

- PR #71 / Batch 4a: independent instruction/group revisions, nested records, named attachments and archive reasons; feature migration 10 and backup-metadata/save changes require Claude review before merge.
- Code head `bb22779`: 404 local Node checks and 142/142 local browser workflows pass; preview build and hosted Node checks pass. Exact-head hosted results are maintained in PR #71; this follow-up changes docs only.
- Next: complete Claude review and green checks for #71, then merge under the owner's batch approval; start one Batch 4b PR from the resulting latest main. Do not start a stacked PR.

## Owner delivery policy

- Target: new project pages ready for a switch-over decision in about five working days; readiness is not activation.
- Order: 4a → 4b → 5, one PR per batch, each starting from latest main after the previous one merges.
- Screen, wording, layout, editor and History-display changes may self-merge after Node, browser and Cloudflare preview checks pass; data tables/migrations, backup/restore and guarded-save changes still wait for Claude review. Fix later screen-review findings in the next PR.
- Build the plainest working version. No optional hardening or rare-race work; record a one-line follow-up and move on. Preserve existing tests; add one success test per feature and one main stale-save/duplicate-submit failure case.
- If a task runs about two hours beyond expectation, stop and report the blocker, simplest route and what that route gives up; do not design around it without the owner.
- Batch 5 is limited to FEATURE_INVENTORY Keep/Rebuild scope. Ask before adding anything unlisted.
- Backup/recovery design stays frozen at schema 9: bug fixes only. PR #71's required new-feature metadata compatibility remains review-gated; it adds no recovery or cleanup mechanism. Never expose passwords, cookies or tokens in chat, files or logs.

## After 4a, 4b and 5 merge

Give the owner one consolidated list: real-Cloudflare timing/binding acceptance, the 100-placement archive-limit sign-off, and feature-checklist acceptance. Then prepare Batch 6's exact data-disposition/backup evidence for approval. Keep all real data, R2 files and backups; switch-over requires separate explicit approval.
