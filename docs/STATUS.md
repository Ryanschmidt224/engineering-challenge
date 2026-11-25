# Building Schmidt — current status

Current state and next step only. Keep at most three lines per PR; no dated handoffs. Behavior: HISTORY_REWRITE_PLAN.md; retained scope: FEATURE_INVENTORY.md; deferred items: FOLLOWUPS.md.

## Current

Production follows main; its exact head/build is tracked by GitHub deployment checks. The owner has approved production switch-over; that approval is retained and must not be requested again. NEW_PROJECT_ENGINE remains off while integration, legacy read-only preservation and required acceptance checks are completed. No real data, files or backups are deleted or overwritten.

- Integrated #75–#81 and the #83 rollback note. Claude's late reviews approved #78–#81 without fixes; #82's configuration review has no blocking code issue. The activation draft stays held, and production remains off.
- Manual source/recovery/unchanged-source reports remain in proofs/PROJECT_CUTOVER_ACCEPTANCE.json. Source `0fc670b` and recovery `8c09362` builds pass; only the recovery D1 override differs. Actual platform timing/acceptance still needs secure operator access. Activation and the Archive limit are already approved; SWITCHOVER.md records the remaining steps.
- Feature-tree scrolling repair removes the obsolete clipping rule and bounds long trees on narrow screens. Desktop/phone regressions fail before and pass after the repair; local checks pass (425 code, 168 browser). Require green CI before merging; no backend, save-guard or production-gate changes. Next: the secure real-platform run and held activation.

## Early switch-over policy

- Pre-switch order: 4b and 5a (merged), then Claude's combined v3 media/backups integration requested in issue #74, then switch-over readiness work. Later Batch 5 groups wait for the owner's requested order; do not create stacked feature PRs.
- Nightly: the existing cron calls the existing engine export for changed projects; append-only .bsproject objects under automatic-backups/engine/. Claude's reviewed schema uses engine_media with photo/picture roles in the API; later file roles are reserved in its CHECK only. Existing engine_file_links remain unchanged; no files/drawings/code feature work is added.
- Legacy pages/data stay in place, read-only; new work goes to the engine. No deletion, import or mandatory project migration. Moving individual legacy projects is a separate optional later job. The server-enforced legacy read-only boundary has Claude approval; its deployed verification remains required before activation.
- The owner plans a project-data clean-out after handoff. Treat that as a separate later operation with exact projects/storage/backups scope confirmed then; retain all current source/proof data during acceptance.
- Screen, wording, layout, editor and History-display changes may self-merge after Node, browser and Cloudflare preview checks pass; data tables/migrations, backup/restore and guarded-save changes still wait for Claude review. Fix later screen-review findings in the next PR.
- Build the plainest working version. No optional hardening or rare-race work; record a one-line follow-up and move on. Preserve existing tests; add one success test per feature and one main stale-save/duplicate-submit failure case.
- The owner's overnight direction favors autonomous implementation and fixing review findings over waiting for routine approval, within the approved switch-over scope. Existing gates for production readiness, destructive actions and secure credentials still apply.
- If a task runs about two hours beyond expectation, stop and report the blocker, simplest route and what that route gives up; do not design around it without the owner.
- Batch 5 is limited to FEATURE_INVENTORY Keep/Rebuild scope. Ask before adding anything unlisted.
- Backup/recovery design stays frozen at schema 9: bug fixes only. Claude approved the additive instruction metadata compatibility in merged 4a; it adds no recovery or cleanup mechanism. Never expose passwords, cookies or tokens in chat, files or logs.

## Switch-over approval package

After the reduced prerequisites merge, provide one list: real-Cloudflare timing/acceptance run; the accepted 100-placement Archive rule; confirmation legacy pages are read-only and nothing was deleted. Tell the owner when to sign in for that run. Prepare and validate the exact activation change using the owner's already-granted switch-over approval. Do not request the Archive decision or activation approval again, and do not treat approval as a waiver of required code reviews or readiness checks.

## Capacity failure investigation

Run 45625755567 remains failed: attempt 1 returned 503 during revision 3; attempt 2 returned 200 headers for revision 4, replay and History but never retained a verified fourth sample. A 200 header alone does not prove a complete JSON body or intact snapshot. The client previously swallowed JSON/body errors into an empty object, and the runner discarded the resulting exception. Response-read failures now reject explicitly, preserve the exact retry operation and loaded token, and produce an allowlisted diagnostic code; separate save/replay/History phases distinguish the next failure without recording response bodies or credentials. Six revisions, record counts and recovery checks remain unchanged. No backend data-integrity cause is confirmed yet; activation #82 stays held pending actual passing platform evidence and required reviews.

## Preview logging investigation

The acceptance source branch has no explicit observability setting in Wrangler. Enabling Previews Base does not demonstrate that an existing preview deployment records logs. Cloudflare supports per-preview dashboard observability settings, but no invocation was visible after the owner enabled them and made an unauthenticated API request. The deployed logging state is still unverified; no claim is made that redeployment alone fixes the platform issue.

Add explicit persisted invocation logging at full sampling under previews.observability only, with production configuration and all bindings unchanged. After review, apply the same configuration to the pinned source and recovery branches while preserving the recovery D1 override, deploy, and verify an unsigned environment request appears in that individual preview's logs before another capacity run. Retain runtime deployment identities and assess new evidence; #82 remains held. No cookies, request bodies or credentials should be added to application logging.

References: https://developers.cloudflare.com/workers/previews/configuration/ and https://developers.cloudflare.com/workers/previews/test-and-debug/ .
