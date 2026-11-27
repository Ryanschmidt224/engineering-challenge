# BuildingSchmidt combined whole-site review and work plan

November 27, 2026 · Ryan Schmidt · Baseline: `b99fab06326e9e37f632af2eb5a3991899006344` (#142)

## Decision

Keep the current private Cloudflare application. Neither review supports another rewrite. Consolidate the remaining runtime boundaries in small changes while retaining project commands, immutable history/files, owner checks and recovery fences.

This combines Ryan's supplied November 26 whole-site code review (F1–F3, S1–S6, M1–M2) with `BuildingSchmidt_Structural_Review_2026-11-26.md`. The findings below were checked against current main before implementation; no active implementation PR was found. Historical drafts #32 and #91 are not part of this work.

## Evaluation of the supplied review

The cleanup findings are well grounded. Compressed project modules, unused tile writers/resolvers, live proof tools, the old Projects availability variable and three unused helpers remain in #142. Removing them does not require replacing the architecture. The proof workflows have useful recovery coverage, so move them into the disposable test server rather than deleting the tests.

The review's “nothing urgent” conclusion needs qualification. There is no demonstrated live exploit or data-loss incident, but development-tool advisories and incomplete automatic recovery coverage deserve the next maintenance batch. The attached review identifies concrete weaknesses the shorter review omits: the route test matches zero routes, temporary storage errors can be classified as input/session failures, lesson previews are not disposed and completed project command bodies remain in memory.

A tested whole-site exporter is not an automatic whole-site backup. The Worker currently schedules only changed-project archives. Workshop and Lessons are included in a manually requested whole-site export; lesson-only or Workshop-only changes do not cause an automatic recovery set to advance. The supplied review accurately distinguishes manual Workshop export from whole-site export, but those coverage differences should be visible in the application.

The supplied “297 passing / 4 failing” describes the other workspace, not four known application defects. The #142 release had 301 code tests and 133 browser workflows passing. Re-run the candidate checks and report their actual results; do not suppress failures on the basis of an older count.

## Combined disposition

| Supplied finding | Evaluation and action | Sequence |
| --- | --- | --- |
| F1: wrong-password attempts have no limit | Agree. Prefer a deliberate edge limit when configured; otherwise use a durable bounded limiter. A counter in a Worker isolate alone does not protect distributed requests. Verify both account and legacy password entry paths before implementing. | Next reliability batch |
| F2: obsolete Projects switch | Agree. Remove the gate at the Worker, direct project entry, scheduled backups and Workshop project-use projection. Keep owner/origin checks and read-only schema readiness. | Batch 1 |
| F3: browser security headers | Agree. Add headers with a tested policy compatible with existing inline module startup, photos, downloads and calculators. Do not blindly apply a CSP that breaks current pages. | Following batch |
| S1: compressed project modules | Agree. Format current modules and enroll them in the maintained formatter. Compare normalized code to prove formatting-only files keep behavior. Existing 40 KB limits stay. | Batch 1 |
| S2: unused Info Bits runtime | Agree. Retire the API and target resolver; retain the old tile/link tables, migrations, read-only export and old-backup verification/restore. Do not reintroduce a second notebook. | Batch 1 |
| S3: live switch-over proofs | Agree with adjustment: move tools and synthetic command proof into tests, outside the asset deployment and Worker import graph. Keep browser source/independent-target recovery coverage. Retain real import/export/restore logic. | Batch 1 |
| S4: stale STATUS and dated documents | Agree. Replace STATUS with one current page; move dated batch/rollout/release evidence into history and fix relative Markdown links. | Batch 1 |
| S5: unused helpers | Agree. Remove `attachmentPicker`, `containerHelp` and `decodeBytes`. Keep used binary encoding/digest helpers. | Batch 1 |
| S6: about 85 MB of retired stored files | Plausible operational estimate, not independently remeasured in this pass. Leave stored objects in place. A future purge needs an exact inventory, reference check, verified independent backup and explicit deletion scope; source retirement does not require it. | Deferred |
| M1: nightly backup failure visibility | Agree. Show the last attempt and success time with stale/failure state and explicit coverage. A green project backup must not imply Lessons/Workshop protection. | Next reliability batch |
| M2: Workshop export omits Lessons | Accurate, but a Workshop-scoped archive need not become a second whole-site format. Clarify the scope and direct users to whole-site backup. Design automatic whole-site coverage separately. | Next reliability batch |

| Additional finding from the attached review | Action | Sequence |
| --- | --- | --- |
| Automatic recovery covers Projects only | Design a bounded whole-site recovery policy, exclude earlier backup objects to prevent recursion, retain a recovery/configuration checklist and independently recoverable copy. Verify lesson-only and Workshop-only changes, stored bytes, restart and bounded growth. | Next reliability batch |
| Development dependency advisories | Update supported Miniflare/transitive dependencies in an isolated change; verify actual dependency tree/audit, native D1 recovery, browser suite and build. Maintain CI actions. No automatic downgrade from `npm audit fix`. | Next reliability batch |
| Duplicate-route guard matches no routes | Replace source-format regex with the actual declared dispatch registry. Require the complete expected route set and prove a duplicate is rejected. | Batch 1 |
| Save/upload/error behavior differs | Standardize error classification and visible save/retry states, preserving domain transactions and original operation identities. Verify lost replies, storage failures, session expiry, conflicts and partial uploads across all three features. | Following batch |
| Old/new photo representations coexist | Keep ordered photos canonical for current project galleries, bound old standalone compatibility and preserve historical evidence. Workshop single-cover and lesson step photos remain intentional exceptions. | Following batch |
| Preview URLs/completed commands retain memory | Add lifecycle cleanup and command acknowledgment without dropping uncertain commands or retry identity. Test repeated use and lost replies. | Following batch |
| UI standards describe old behavior | Update current photo and autosave guidance now; shared-button/visual contracts can follow. | Docs now; contracts later |
| Thumbnail originals and eager collection reads | Measure representative photos, larger notebooks and long sessions before derivatives, paging or schema changes. Keep originals and immutable ownership. | Measured later work |

## Batch 1 implementation boundary

The first candidate removes only unused runtime surfaces and the obsolete gate, formats current project browser modules, repairs the route guard, and reconciles current documentation. Stored rows, objects, account credentials, backup formats, applied migrations and recovery fences are preserved. Live sign-in rate limiting, automatic whole-site backups and CSP are not claimed by this candidate.

Production no longer provides `/api/knowledge` or `/api/project-engine/proof`; authenticated requests receive the same protected 410 boundary as other retired APIs. The removed proof HTML and scripts are excluded from deployment. The disposable test server serves the retained acceptance UI under `/__test__/proof/` and runs its synthetic command proof only under `/__test__/command-proof`.

Validation must establish:

- Normalized JavaScript is identical for each formatting-only project module; current module budgets and syntax/style/CSS ownership checks pass.
- Projects and nightly backups work without `NEW_PROJECT_ENGINE`; signed-out/direct-handler and wrong-origin requests remain denied. A scheduled run never migrates an uninitialized database.
- Old tile/link rows survive attempted calls to the retired API and round-trip through the existing Workshop export/restore. Current Lessons saves, aliases, archive/restore and photos remain covered.
- The runtime API registry contains all expected exact routes, rejects a deliberate duplicate, and the shipped import graph contains no orphan modules or test proof helpers.
- All current browser workflows, including source and independent-target recovery, run against the candidate. Native Cloudflare D1/R2 whole-site recovery and a production Worker build pass.
- Record exact-head CI and deployment evidence on the release PR. A passing fixture rehearsal does not imply production backup restoration or account controls were tested.

## Owner additions — queued November 27

These are approved follow-ups, with no required order or immediate implementation:

| Item | Requested result | Acceptance |
| --- | --- | --- |
| Photo reordering feels slow | Measure and reduce move-to-confirmation time where practical. Always give immediate visible feedback while the guarded reorder saves; avoid a silent pause. | Drag and earlier/later actions show activity promptly, settle to confirmed order, and preserve the prior saved order/retry path after failure or conflict. Do not imply an unconfirmed move is saved. |
| “What happened?” looks separate from the lesson | Place it in a clearly related frame with label/input spacing consistent with the lesson's step segments. Retain its role as the lesson's opening description/title. | New and reopened lessons visibly group the opening field with their content on desktop and phone; autosave/focus behavior remains intact. |
| Persistent “Saved” strip is unclear | Remove the idle Saved field/strip shown beneath Calculators. Retain concise feedback while saving and actionable errors/retry/conflict states. | The idle editor has no persistent Saved banner or empty banner gap; pending work and failures remain obvious. |

The supplied screenshot illustrates the last two issues. These additions stay on the plan while Batch 1 validation completes; this candidate does not claim their UI has changed.

## Work that stays out of this cycle

No new frontend framework, community/multi-user infrastructure or independent hosted project URLs. Preserve the bulky delete/restore safety mechanisms. Do not merge old draft #91 automatically, reinterpret stored prices/quantities, or delete historical file bytes as a side effect of removing code.

Current implementation and release checkpoint: [STATUS.md](STATUS.md). Code ownership: [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md). Earlier audit history: [November 26 follow-ups](history/AUDIT-FOLLOWUPS-2026-11-26.md).
