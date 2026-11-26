# Building Schmidt — current status

Private single-owner application on Cloudflare Workers Paid. The owner approved switch-over and the 100-placement Archive limit. Legacy source projects, files and backups remain preserved. The owner-authorized TB001 copy is documented below.

## Current

- PR #92 makes preview logging and the paid-default 30000 ms CPU budget explicit. Both acceptance previews deployed that budget without backend changes; independent recovery keeps its separate D1 binding.
- The capacity-1000 gate passed in run 45663128437 attempt 3: functional proofs, six revisions and History checks, export, independent import/retry, restored History, and unchanged-source verification. See docs/proofs/PAID_CAPACITY_1000.json; raw evidence remains in the Actions artifact. Exact CPU/D1 execution and cleanup-trigger comparisons remain deferred under SWITCHOVER.md.
- PR #82 merged at `e9e1f3a45fbaea6321d266ae3d3f270cc8d5ea70`; the new engine is active. Production uses the same 30000 ms paid CPU budget that passed on the previews. The owner has used the new site, and TB001 was copied and export-verified through its UI. The first scheduled backup remains a separate observation; do not infer it from UI or preview checks.
- Draft #91 is an undeployed retry optimization with 430 passing local tests, awaiting recovery-code review. It is not an activation prerequisite and must not be merged automatically.

## Boundaries

Preserve every existing project and backup. No cleanup or real-project import is authorized by this switch-over. Keep production building-schmidt-workshop D1 and building-schmidt-photos R2, preview isolation, AI settings and cron unchanged. Owner update Nov 25: automatic/mandatory Claude review is discontinued; proceed with approved work after tests and deployed verification. Prompt the owner for particularly sensitive releases, including permanent deletion or changes that risk losing saved data. The owner's activation approval persists, but does not waive checks or deployed verification.

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

The project summary reuses the part overview shell: the first project-gallery photo on the left, summary fields on the right, and the existing responsive stacking on phones. Photo management now opens from the shared Edit photo pencil alongside the overview picture. No separate project-picture storage or media migration is introduced.


## Label/value proximity

Shared editable and read-only field rows use one bounded label-width/gap policy from theme.css. The project-only percentage override is removed, so wide part controls, summary fields, settings, Workshop and information forms inherit the same rule and the existing phone stacking. This changes geometry only.


## Info Bits and entry clarity

The information area is named Info Bits. The project name above the tree is a non-interactive title label; Project summary remains the navigation action and the project context menu/root drop destination remain available. Entries use one attachment area, with an optional prompt destination for multi-prompt entries. Existing file names, prompt associations, guarded uploads and retries remain intact. Event date is removed from the editing/display UI while existing saved values and automatic timestamps remain preserved. Parent defaults read Top-level entry and No group.


## Project summary root

The project root opens Project summary. A single visible, unit-quantity assembly shares that summary presentation, so its children appear directly under the project; multiple root builds and quantity multipliers remain explicit. Show top assembly restores the separate row, and Add another top-level assembly creates a separate branch. Assembly details, instructions, CAD files, history and numbered revisions remain available on the summary using their original item/placement IDs. This is a reversible view projection, not a migration: parents, quantities, numbers, saved revisions and backups are unchanged. The project root itself has no part number or BOM quantity. Summary assembly History/Revisions load on opening their sections. Visible engineering-file wording is now CAD files; stored event text and file roles stay unchanged.

Photo controls now use the shared bottom-right Edit photo pencil on project, part and assembly overview pictures. It expands picture replacement/removal and gallery upload/caption/reorder/removal tools in place. There are no separate Part photos/Subassembly photos/Project photos sections. Existing pictures, gallery photos and stored files retain their IDs and roles; removing a displayed photo still keeps its stored file. Top assembly photo controls remain available inside the summary photo tools.

The shared record attachment picker has a styled Choose files button and a visible keyboard-focusable drag/drop and right-click image paste target. Arbitrary supported files can be dropped; pasted images use the common photo paste component. Explicit selection/upload, destination groups, limits, guarded saves and immutable file IDs remain unchanged.

Project summary tree navigation keeps a neutral outlined frame without selected/hover background changes; keyboard focus remains visible. Workspace section header styling now reaches nested shared sections as well as direct children, so summary BOM/Tools and other section headers use the same surface tokens and open-state corners.

Refresh/save feedback now uses the shared ui-status-toast outside document flow, so inserting or clearing Refreshing project does not push the workspace down/up. Empty notifications contain no empty span or visible box. The delayed-summary revalidation browser check also asserts workspace position stays fixed while the refresh message is visible.

Expanded overview photo tools span the full content width. Multiple gallery photos default to a responsive Tiles grid, with Details/List alternatives supplied by the same view-mode control as the project directory. Details shows captions, names and sizes; modes are a display preference only and preserve file order/IDs.

Shared section action rows now keep their standard following gap even when empty/hidden content lies before the next visible block. Parts Management groups filters, keeps secondary filters collapsed, uses a horizontal category strip instead of a second side rail, and shows expandable compact specifications. Full columns, searching all saved fields, column resizing, item edits and stored specifications remain unchanged.

The project root frame is removed. Same-project navigation (parts, BOM, History, individual parts and browser back/forward) renders the loaded project immediately while starting a fresh state read in parallel with optional history rendering. Revision changes still replace the cached view, stale completions are sequence-guarded, and save-triggered refreshes still load fresh data. A gated browser case switches across pages with state/history reads held to prove display does not wait for those round trips.

Editable photo controls now share an unfilled pencil over the image’s bottom-right corner, with tools opening below. Gallery thumbnails and Workshop photo references use that shared control; live instruction attachment photos open their guarded Edit entry flow, while historical snapshots remain read-only. Shared photo upload rows place a framed chooser before a compact, tinted drop/paste target (roughly one quarter of desktop width, wrapping on phones).

The top-level parent choice displays its project name in shared part/placement selectors and Workshop project-use selectors. Overview pages group assembly/part History, numbered Revisions and project History inside one Revisions / History disclosure. Existing scope IDs, controls, immutable snapshots and history APIs are retained; history/revision lists load when their inner group opens.

The owner restored the pencil position below each photo at the right edge, retaining the unfilled silhouette. The shared action row applies that placement consistently to overview, gallery, Workshop and current instruction photos; the compact tinted upload row is unchanged.

## Electronics template review

- PR #106 restores reviewed Workshop AI lookup and Edit template wording; the production build and served modules were verified.
- The Electronics template update covers 22 shipped families, with DigiKey terminology, conditional ratings and preserved values/customizations; see ELECTRONICS_TEMPLATES_REVIEW.md.
- Owner ended routine Claude-review gating. Its data-only Workshop migration 3 preserves saved values and customizations and may proceed after green exact-head checks; it performs no project/file deletion.
