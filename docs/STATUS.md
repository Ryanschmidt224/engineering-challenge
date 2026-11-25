# Building Schmidt — current status

Private single-owner application on Cloudflare Workers Paid. The owner approved switch-over and the 100-placement Archive limit. Legacy source projects, files and backups remain preserved. The owner-authorized TB001 copy is documented below.

## Current

- PR #92 makes preview logging and the paid-default 30000 ms CPU budget explicit. Both acceptance previews deployed that budget without backend changes; independent recovery keeps its separate D1 binding.
- The capacity-1000 gate passed in run 45663128437 attempt 3: functional proofs, six revisions and History checks, export, independent import/retry, restored History, and unchanged-source verification. See docs/proofs/PAID_CAPACITY_1000.json; raw evidence remains in the Actions artifact. Exact CPU/D1 execution and cleanup-trigger comparisons remain deferred under SWITCHOVER.md.
- PR #82 merged at `e9e1f3a45fbaea6321d266ae3d3f270cc8d5ea70`; the new engine is active. Production uses the same 30000 ms paid CPU budget that passed on the previews. The owner has used the new site, and TB001 was copied and export-verified through its UI. The first scheduled backup remains a separate observation; do not infer it from UI or preview checks.
- Draft #91 is an undeployed retry optimization with 430 passing local tests, awaiting recovery-code review. It is not an activation prerequisite and must not be merged automatically.

## Boundaries

Preserve every existing project and backup. No cleanup or real-project import is authorized by this switch-over. Keep production building-schmidt-workshop D1 and building-schmidt-photos R2, preview isolation, AI settings and cron unchanged. Recovery/schema/save-guard changes require Claude review; screen-only changes follow the existing green-check policy. The owner's activation approval persists, but does not waive checks or deployed verification.

## Next

Validate the refreshed activation candidate, deploy using the existing approval, then complete the owner-only UI/API smoke checks in SWITCHOVER.md. Do not declare the system ready for valuable data until those observations pass. The first scheduled production backup at 02:17 Phoenix remains pending until actually observed.

## Familiar project layout

The project shell restores a framed green feature tree, persistent project-page links below the tree, compact part/photo/build panels, paired label/value fields, and responsive summary cards. Existing editors, guarded save handlers, History, backups and storage remain the active engine implementation. Desktop, tablet and phone navigation checks assert no browse-time writes or saved-data changes. UI-only release follows the existing code/browser/Cloudflare checks.

## Familiar wording and editor groups

The familiar UI pass restored the short top-level feature-tree label, subsequently renamed Generic Part Name by the owner. Specific Part Name remains separate and is the fallback when no generic label is set. Reading and editing use Item identity, Part details and Display options groups with compact label/value rows. Written records display Notes, Tests / Measurements, Failures and Change notes; numbered saved Revisions remain separate. Instruction retirement displays Archive step. These changes preserve existing field keys, record types, validation, guarded commands and backup formats.

The owner separately requested a new-engine copy of the legacy TB001 project. This authorizes that specific non-destructive copy only; it does not authorize blanket migration or deletion. TB001 was copied through the existing owner UI after sign-in succeeded: one TB001 assembly with the three original numbered parts, two instructions, five entries, three project photos and the part/assembly pictures. All 11 exported files passed hash checks, including a lossless source bundle covering all 25 original objects. A second legacy export matched the original object array exactly. Earlier revisions/archive remain legacy references rather than fabricated numbered engine revisions; historical prices/supplier facts are retained as specifications, not active purchasing calculations.


## Compact tree and navigation follow-up

The owner requested Generic Part Name and Specific Part Name terminology, a quieter Add menu with context actions and a one-time right-click hint, tree drag/drop, denser shared controls and faster summary navigation. These remain presentation work: existing field keys, record types, state reads and guarded commands stay intact. A loaded summary can render immediately while its normal state read revalidates; cold opens still require that read. Desktop navigation, toolbar and table actions share density tokens; touch targets remain larger.


## Hierarchy and group clarity

Feature-tree labels put the issued part number before the Generic Part Name with matching typography. Dotted connectors follow the rendered placement hierarchy and stop at the last visible sibling. Part detail groups use shaded, accented headings without expanding the label/value rows. Status, selection, context menus, collapse and guarded drag/drop behavior remain intact.

## Cleanup assessment

The active project screen loads its own workspace styles rather than the frozen legacy override cascade. The retained legacy index still owns legacy reading, exports and rollback paths; it is not dead code. The first safe cleanup is keeping the handoff accurate (activation and current wording above) and removing superseded selectors only as their components are replaced. See CSS_INVENTORY.md and UI_STANDARDS.md for existing ownership and guardrails. A larger legacy extraction/removal must first map those live dependencies, preserve export/history access and verify production backup behavior. Do not combine that work with screen polish or merge held recovery PR #91 as cleanup.


## Shared UI dependency separation

Calculators now have an independent calculators.html entrypoint, reusing the canonical calculator catalogue and form renderer. The owner subsequently moved the navigation entry into Bits of information; standalone and legacy hash routes remain compatible and import the same catalogue. Calculator rules move out of site.css into their shared feature owner, with no duplicate cascade. The standalone page does not bootstrap legacy projects, wires or accounts. Shared history dialogs require a supplied photo uploader; only legacy-history-dialog.js knows the recipe-file upload API. Active engine uploads retain their guarded client/retry/version handling. No API, storage, authentication, migration or backup contract changes. The code guide now distinguishes active engine owners from retained legacy owners.


## Information area naming

The owner renamed the visible Knowledge area to Bits of information. Navigation, page headings, related-information sections and tile-link labels use the new wording. Calculators live in a collapsed shared section on this page; there is no separate main navigation tab. Existing standalone and legacy calculator links remain compatible. Existing knowledge.html links, API paths, IDs, stored tiles and backups retain their established contracts.


## Project summary overview

The project summary reuses the part overview shell: the first project-gallery photo on the left, summary fields on the right, and the existing responsive stacking on phones. Photo management remains in the full-width gallery below. No separate project-picture storage or media migration is introduced.
