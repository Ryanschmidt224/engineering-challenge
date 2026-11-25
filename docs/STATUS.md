# Building Schmidt — current status

Private single-owner application on Cloudflare Workers Paid. The owner approved switch-over and the 100-placement Archive limit. No legacy data, files or backups have been deleted, imported or moved.

## Current

- PR #92 makes preview logging and the paid-default 30000 ms CPU budget explicit. Both acceptance previews deployed that budget without backend changes; independent recovery keeps its separate D1 binding.
- The capacity-1000 gate passed in run 45663128437 attempt 3: functional proofs, six revisions and History checks, export, independent import/retry, restored History, and unchanged-source verification. See docs/proofs/PAID_CAPACITY_1000.json; raw evidence remains in the Actions artifact. Exact CPU/D1 execution and cleanup-trigger comparisons remain deferred under SWITCHOVER.md.
- PR #82 is refreshed with current main and passing acceptance evidence. Its flag/version metadata behavior retains Claude's reviewed activation; production also explicitly uses the same 30000 ms paid CPU budget that passed on the previews. Merge only after this exact candidate passes checks. Production owner smoke testing and the first scheduled backup remain separate required observations.
- Draft #91 is an undeployed retry optimization with 430 passing local tests, awaiting recovery-code review. It is not an activation prerequisite and must not be merged automatically.

## Boundaries

Preserve every existing project and backup. No cleanup or real-project import is authorized by this switch-over. Keep production building-schmidt-workshop D1 and building-schmidt-photos R2, preview isolation, AI settings and cron unchanged. Recovery/schema/save-guard changes require Claude review; screen-only changes follow the existing green-check policy. The owner's activation approval persists, but does not waive checks or deployed verification.

## Next

Validate the refreshed activation candidate, deploy using the existing approval, then complete the owner-only UI/API smoke checks in SWITCHOVER.md. Do not declare the system ready for valuable data until those observations pass. The first scheduled production backup at 02:17 Phoenix remains pending until actually observed.
