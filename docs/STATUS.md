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

## Familiar project layout

The project shell restores a framed green feature tree, persistent project-page links below the tree, compact part/photo/build panels, paired label/value fields, and responsive summary cards. Existing editors, guarded save handlers, History, backups and storage remain the active engine implementation. Desktop, tablet and phone navigation checks assert no browse-time writes or saved-data changes. UI-only release follows the existing code/browser/Cloudflare checks.

## Familiar wording and editor groups

The next UI pass restores Container (name) as the short top-level feature-tree label, with Part name retained separately and used as the fallback when no container label is set. Reading and editing use Container, Part details and Display options groups with compact label/value rows. Written records display Notes, Tests / Measurements, Failures and Change notes; numbered saved Revisions remain separate. Instruction retirement displays Archive step. These changes preserve existing field keys, record types, validation, guarded commands and backup formats.

The owner separately requested a new-engine copy of the legacy TB001 project. This authorizes that specific non-destructive copy only; it does not authorize blanket migration or deletion. TB001 was copied through the existing owner UI after sign-in succeeded: one TB001 assembly with the three original numbered parts, two instructions, five entries, three project photos and the part/assembly pictures. All 11 exported files passed hash checks, including a lossless source bundle covering all 25 original objects. A second legacy export matched the original object array exactly. Earlier revisions/archive remain legacy references rather than fabricated numbered engine revisions; historical prices/supplier facts are retained as specifications, not active purchasing calculations.


## Compact tree and navigation follow-up

The owner requested Generic Part Name and Specific Part Name terminology, a quieter Add menu with context actions and a one-time right-click hint, tree drag/drop, denser shared controls and faster summary navigation. These remain presentation work: existing field keys, record types, state reads and guarded commands stay intact. A loaded summary can render immediately while its normal state read revalidates; cold opens still require that read. Desktop navigation, toolbar and table actions share density tokens; touch targets remain larger.
