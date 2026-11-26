> Historical checkpoint before the owner-authorized legacy retirement on November 26, 2026. See the current document in `docs/`.

# Building Schmidt — current status

Private single-owner application on Cloudflare Workers Paid. The new project engine is active. The owner approved switch-over, permanent owner-confirmed project deletion, and the 100-placement Archive limit. Legacy source projects, files and backups remain preserved except when the owner explicitly uses the confirmed permanent-delete action. The owner-authorized TB001 copy is documented below.

## Current checkpoint — November 26, 2026

This is the authoritative project checkpoint. `STATUS.md` at the repository root points here. Deployment evidence is recorded on each release PR; this file is a dated summary, not a promise that a historical commit is forever the branch tip.

- PRs #123–#130 are released and reviewed: Website settings owns both backup actions, one Account menu is shared across pages, directory cards use the first summary photo, and the Wire resistance calculator is available in Info Bits.
- PR #131 implements audit findings 4, 12, 13 and 14: exact template AI fields, persistent per-value evidence and identity validation, frozen project copies, and recoverable document saves. Claude approved after adding the pending-only **Forget unconfirmed document** correction. Release evidence is on [PR #131](https://github.com/Ryanschmidt224/engineering-challenge/pull/131).
- **Release checkpoint:** PR #131 merged at `274f454437821c8155d341a44fd395e4fd05c3b1` after 510 code checks, 233 browser workflows and the preview build passed. Production build `4a8afe59-1717-41e7-8100-8936c9c01916` succeeded and deployed Worker `3e8237d6-ea7e-4249-8084-ad179c9d9425`.
- The full isolated local Cloudflare runtime restore passed: 31 tables, 570 rows, all 6 objects, 9 authenticated routes, a cold restart, foreign keys and independent writes. The proof now includes AI provenance; project and Workshop catalog backup/import also preserve evidence. This is synthetic local-runtime evidence, not a production or separate hosted-account restoration. See [restore report](ISOLATED-SITE-RESTORE-2026-11-26.md).
- Projects loads normally after PR #121 corrected the D1 limit in the v15 settings seed. The earlier failed initializer blocked the list; it did not establish project deletion. PR #119 separately removed cross-request pending initialization promises.
- Permanent project deletion includes its stored data and automatic backups. Workshop originals remain separate. No production project was deleted during these checks.
- Actual nightly-backup listing/download verification and the longer real-use trial remain owner-workflow checks. Do not replace those with fixture/CI claims. The completed capacity/activation gate and deletion proof remain closed; draft #91 is a deferred optimization.
- The first formatting pass expands the recently changed Workshop/project modules and adds an incremental formatting check. The remaining compressed controller and frozen legacy bundles still need gradual extraction. The previous small CSS pass removed duplicate/obsolete photo rules; broad legacy CSS consolidation is not complete.
- See the [audit tracker](AUDIT-FOLLOWUPS-2026-11-26.md) for each finding. The audit is not wholly complete. The Workshop-wide layout redesign is a future upgrade; independent hosted URLs are a late-priority future idea, not current implementation work.

## Boundaries

Preserve existing projects, files, downloaded proofs and backups. Automated tests must not delete production projects, restore/import data, modify accounts or secrets, or make paid AI calls. Permanent deletion remains an explicit owner action in the UI; code cleanup does not authorize data deletion. Keep production `building-schmidt-workshop` D1, `building-schmidt-photos` R2, preview isolation, AI settings and cron unchanged.

Owner update Nov 25: routine or mandatory Claude review is discontinued; proceed with approved work after relevant Node/browser/Cloudflare checks and deployed verification. Prompt the owner only for a new particularly sensitive change after implementation is concrete and tested. The 1–2 week real-use trial, first nightly backup download and separate-project restore remain prerequisites for later owner-scoped legacy-code removal.

## Next

Continue bounded code readability and shared-component cleanup while preserving behavior. Measure project-navigation rereads before optimizing. Settings choices now refresh across tabs and on focus without replacing drafts; shared navigation uses explicit application mode rather than the legacy project list. Shared photo controls use their image stage for pencil placement and standard buttons, replacing JavaScript geometry compensation. Verify actual nightly backup download and a separate-project restore through the owner workflow when access is available. Do not repeat completed capacity/destructive production proofs or turn future ideas into approved features.

## Historical implementation notes

The sections below describe earlier implementation states and subsequent requests. Use Current, Boundaries and the audit tracker for active status; earlier layout descriptions are not current specifications.

### Familiar project layout

The project shell restores a framed green feature tree, persistent project-page links below the tree, compact part/photo/build panels, paired label/value fields, and responsive summary cards. Existing editors, guarded save handlers, History, backups and storage remain the active engine implementation. Desktop, tablet and phone navigation checks assert no browse-time writes or saved-data changes. UI-only release follows the existing code/browser/Cloudflare checks.

### Familiar wording and editor groups

The familiar UI pass restored the short top-level feature-tree label, subsequently renamed Generic Part Name by the owner. Specific Part Name remains separate and is the fallback when no generic label is set. Reading and editing use Item identity, Part details and Display options groups with compact label/value rows. Written records display Notes, Tests / Measurements, Failures and Change notes; numbered saved Revisions remain separate. Instruction retirement displays Archive step. These changes preserve existing field keys, record types, validation, guarded commands and backup formats.

The owner separately requested a new-engine copy of the legacy TB001 project. This authorizes that specific non-destructive copy only; it does not authorize blanket migration or deletion. TB001 was copied through the existing owner UI after sign-in succeeded: one TB001 assembly with the three original numbered parts, two instructions, five entries, three project photos and the part/assembly pictures. All 11 exported files passed hash checks, including a lossless source bundle covering all 25 original objects. A second legacy export matched the original object array exactly. Earlier revisions/archive remain legacy references rather than fabricated numbered engine revisions; historical prices/supplier facts are retained as specifications, not active purchasing calculations.


### Compact tree and navigation follow-up

The owner requested Generic Part Name and Specific Part Name terminology, a quieter Add menu with context actions and a one-time right-click hint, tree drag/drop, denser shared controls and faster summary navigation. These remain presentation work: existing field keys, record types, state reads and guarded commands stay intact. A loaded summary can render immediately while its normal state read revalidates; cold opens still require that read. Desktop navigation, toolbar and table actions share density tokens; touch targets remain larger.


### Hierarchy and group clarity

Feature-tree labels put the issued part number before the Generic Part Name with matching typography. Dotted connectors follow the rendered placement hierarchy and stop at the last visible sibling. Part detail groups use shaded, accented headings without expanding the label/value rows. Status, selection, context menus, collapse and guarded drag/drop behavior remain intact.

### Cleanup assessment

The active project screen loads its own workspace styles rather than the frozen legacy override cascade. The retained legacy index still owns legacy reading, exports and rollback paths; it is not dead code. The first safe cleanup is keeping the handoff accurate (activation and current wording above) and removing superseded selectors only as their components are replaced. See CSS_INVENTORY.md and UI_STANDARDS.md for existing ownership and guardrails. A larger legacy extraction/removal must first map those live dependencies, preserve export/history access and verify production backup behavior. Do not combine that work with screen polish or merge held recovery PR #91 as cleanup.


### Shared UI dependency separation

Calculators now have an independent calculators.html entrypoint, reusing the canonical calculator catalogue and form renderer. The owner subsequently moved the navigation entry into Bits of information; standalone and legacy hash routes remain compatible and import the same catalogue. Calculator rules move out of site.css into their shared feature owner, with no duplicate cascade. The standalone page does not bootstrap legacy projects, wires or accounts. Shared history dialogs require a supplied photo uploader; only legacy-history-dialog.js knows the recipe-file upload API. Active engine uploads retain their guarded client/retry/version handling. No API, storage, authentication, migration or backup contract changes. The code guide now distinguishes active engine owners from retained legacy owners.


### Information area naming

The owner renamed the visible Knowledge area to Bits of information. Navigation, page headings, related-information sections and tile-link labels use the new wording. Calculators live in a collapsed shared section on this page; there is no separate main navigation tab. Existing standalone and legacy calculator links remain compatible. Existing knowledge.html links, API paths, IDs, stored tiles and backups retain their established contracts.


### Project summary overview

The project summary reuses the part overview shell: the first project-gallery photo on the left, summary fields on the right, and the existing responsive stacking on phones. Photo management now opens from the shared Edit photo pencil alongside the overview picture. No separate project-picture storage or media migration is introduced.


### Label/value proximity

Shared editable and read-only field rows use one bounded label-width/gap policy from theme.css. The project-only percentage override is removed, so wide part controls, summary fields, settings, Workshop and information forms inherit the same rule and the existing phone stacking. This changes geometry only.


### Info Bits and entry clarity

The information area is named Info Bits. The project name above the tree is a non-interactive title label; Project summary remains the navigation action and the project context menu/root drop destination remain available. Entries use one attachment area, with an optional prompt destination for multi-prompt entries. Existing file names, prompt associations, guarded uploads and retries remain intact. Event date is removed from the editing/display UI while existing saved values and automatic timestamps remain preserved. Parent defaults read Top-level entry and No group.


### Project summary root

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

### Electronics template review

- PR #106 restores reviewed Workshop AI lookup and Edit template wording; the production build and served modules were verified.
- The Electronics template update covers 22 shipped families, with DigiKey terminology, conditional ratings and preserved values/customizations; see ELECTRONICS_TEMPLATES_REVIEW.md.
- Owner ended routine Claude-review gating. Its data-only Workshop migration 3 preserves saved values and customizations and may proceed after green exact-head checks; it performs no project/file deletion.

### Nov25 summary, whole-site backup and deletion continuation

- #111 restores the legacy summary section stack, including full-width Tools, summary/tags, cost estimates, editable intent with mandatory reasons and retained versions, milestones and project notes. Migration 13 adds capped overview content; small/streamed/readable backups preserve it and older backups remain readable. 445 Node checks and browser/Cloudflare checks passed before merge.
- #112 adds one-click Backup all data with a native save picker, Arizona-date filename, streaming all application D1 data and R2 objects, completion/hash verification and non-destructive offline recovery extraction. 448 Node checks and browser/Cloudflare checks passed before merge. No automatic download or change to backup retention.
- Owner explicitly confirmed permanent deletion includes every project backup and stored project object. Claude reviewed #110 head 87b3212; copied Workshop folder validation/cleanup is corrected and tested, including its late-write fence. Migration 14 is separate from overview migration 13.
- Exact-candidate isolated Cloudflare proof c368234 passed in Actions run 45762047463 against verified preview D1 3314f42f-7c04-4798-99dc-b5b97c4fb82f and preview R2. The copied Workshop attachment project deletion took 6564 ms; the capacity-1000 project deletion took 6654 ms end-to-end, including requests. The independent synthetic project and source Workshop bytes remained exact, and deletion replay passed. Only newly created synthetic project IDs were eligible. No production project was deleted. Full release checks still gate merge.
- Claude #97 tree-drag follow-up: cross-assembly moves offer revision-guarded Undo move; immediate undo succeeds and an intervening save rejects stale undo without modifying saved state. CSS consolidation was completed in #108.


### Website settings and editing controls (next release)

- #115 template-scoped AI lookup is merged; exact-head Node, browser and Cloudflare checks passed. Lookup sits between identity/specifications, requires complete reviewed identity and supplier URL, uses only current template terms, accepts an optional technical document and saves it into the Workshop. Maker mismatches are rejected. Actual paid calls were not used in validation.
- Website settings manages discrete tag choices and project-owner labels/default. Engine migration 15 preserves existing owner data without rebuilding parent tables, keeps deletion/retired-restore fences and leaves access IDs unchanged. Custom owner/tag backups restore independently of global choices.
- Shared photo tools include Save; the unfilled pencil aligns below the actual photo's right edge. Summary/cost/intent edits use quiet header controls only while expanded. Initial-plan input is removed; existing text remains in intent versions.
- See WEBSITE_SETTINGS.md for migration/compatibility details. Focused browser checks and all 463 Node checks passed; full-browser and exact-head release checks still gate deployment.
- The owner subsequently requested removal of the Manufacturer details disclosure and approved the architecture-safe name-link plan. Optional manufacturer fields return to the ordinary layout. The new editor shortcut defaults new custom parts/subassemblies to linked names; existing distinct names remain unlinked. Unchecking restores independent entry. No persistent relationship, extra data field or historical rewrite was added.
