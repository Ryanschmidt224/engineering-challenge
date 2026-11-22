# Workshop reliability review — November 21, 2026 (Arizona)

Baseline: `b26ef55` (current GitHub main when this review started). Existing dirty
checkouts were preserved; changes were made in a separate worktree.

## Data ownership and flow

| Source / action | Destination | Contract |
| --- | --- | --- |
| `catalog-ui.js` category sidebar | `personal-workshop.js` context menu and picker | Delegated handlers survive category rerenders. Selected category is passed into creation. |
| `workshop-template-manager.js` | `/api/workshop-templates` | Main-page editor writes category-scoped definitions, never product values. |
| Template API | R2 `workshop-templates/v1.json` | Separate shared index, conditional object writes plus mandatory per-template revision checks. |
| Applying a template | Item editor's local draft | Copies layout and stable IDs. Keeps existing values; no live link or automatic updates. |
| `workshop-product-builder.js` | Item `productSections` | Ordered sections/fields with Workshop or project scope. Definitions-only mode is used by master editor. |
| Item editor | `/api/workshop-reference` | Explicit Save persists an independent reference with its own revision and layout. |
| Reference API | R2 `workshop-reference-overrides/v1.json` | Seed overrides and authored references; separate from private inventory and templates. |
| Workshop import / explicit reload | Project component snapshot | Project edits use project endpoints; never write the original shared item. |
| My Workshop | Personal Workshop API | Account-owned inventory. Shared reference links do not imply ownership or grant catalog permissions. |

The two persistence endpoints now use `workshop-template-schema.js` for table
layouts, generic definitions, Product Builder fields, category IDs, and limits.
The browser keeps the existing classic-script architecture and DOM editors.

## Verified findings and repairs

| Classification | Priority | Evidence and result |
| --- | --- | --- |
| Confirmed bug | High | Template PUT/DELETE did not require a client revision. A stale client was accepted after an R2 retry. Added random per-template revisions, 428 for missing preconditions, 409 for stale edits/deletes, and checks on every retry. Unrelated-template writes still retry safely. |
| Confirmed bug | High | Specific-to-generic conversion explicitly cleared manufacturer, ordering, and fixed specification values. Removed that destructive conversion. Mode changes now affect visibility; values survive Save and refresh. |
| Confirmed bug | High | Successive template applications accumulated unrelated empty custom rows and Product Builder fields. Track fields imported during the editing session; remove obsolete empty imported fields while retaining authored fields and all populated values. |
| Confirmed bug | High | Item/template validators disagreed about row IDs, duplicate IDs, malformed sections, and standard fields. One server schema now handles both; master writes strip product values. Older UUID-only row IDs remain stable. |
| High-risk design issue | High | Applying a template plus retained fields could exceed limits and silently truncate the draft through UI row caps. Preflight all merged rows/sections before mutating; reject an oversized merge with a usable message. |
| High-risk design issue | Medium | Async item/template responses could arrive after navigation or edit changes. Added request generations, connected-editor checks, transient-dialog cleanup, and save locking. A completed item save cannot reopen an unrelated editor. |
| Moderate maintainability concern | Medium | Part editor retained unreachable master create/update/delete implementations. Removed them; the item editor only applies templates and the main-page builder manages them. |
| Confirmed bug | Medium | Template/Product Builder helper calls reversed class/text arguments, rendering literal “muted” instead of guidance. Corrected those calls. |
| Moderate maintainability concern | Medium | Three application workflows ran the same checks, and the syntax list omitted newly added scripts. Retained one application workflow and one distinct browser workflow; discover all JS sources for syntax checks. |
| Cosmetic inconsistency | Medium | Repeated disclosure-header rules in the last portion of `site-polish.css` superseded each other. Consolidated those geometry/typography declarations; retained the separate Work Instructions button geometry and container layout. |

## Compatibility and permissions

- No data migration, production mutation, or historical deletion was performed.
- Existing template records without a revision can be edited once with
  `expectedRevision: null`; successful writes add a revision. Already-versioned
  records cannot be overwritten through that legacy path.
- Older browser clients missing template preconditions receive 428 and must
  reload. Updated browser asset versions accompany the API change.
- Template/item IDs and separate R2 namespaces remain intact. Definition-only
  template saves never inherit product values. Deleting a master does not touch
  item snapshots.
- Contributor permissions deliberately retain the existing policy: signed-in
  members can edit shared templates and public items. Administrator-only master
  governance would change product policy; no additional role system was added.
- Unknown/malformed template entries are excluded from read results so one bad
  entry does not break the catalog. The underlying index is not rewritten by a
  GET. Storage failures return JSON 503 with retry guidance.
- Validation is stricter for malformed or duplicate IDs and unknown categories.
  Existing generated row IDs (with or without `row-`) remain supported. No
  repair migration is needed for records produced by the current editors.

## Baseline and validation

The unmodified baseline had 207 Node tests: 193 passed, 14 failed. Failures
covered old container wording, duplicate implementation captions, an obsolete
AI auto-apply expectation, exact AI-prompt JSON before new identity fields,
old section-expansion source patterns, old supplier wording, old picker
structure, old Edit handler structure, and a nine-item catalog assumption after
generic resistor/LED seeds were added. Assertions were updated to current
behavior; the AI test now verifies explicit review/apply and unchanged identity.
The test expecting destructive generic conversion was replaced with the
non-destructive contract.

`npm run check` passes all 216 Node tests and discovers JavaScript syntax targets
(including new template scripts, API modules, helpers, and browser specs).
Nine new executable regressions exercise template lifecycle, authentication,
malformed/oversized requests, legacy revisions, delete conflicts, storage
failure, damaged-entry isolation, same-template races, unrelated-index races,
source-value stripping, stable IDs, value preservation, blank-template reset,
and oversized-merge refusal.

Seven additional Playwright scenarios use the **real template and reference
API handlers** with an in-memory conditional-write R2 fixture. They cover
creation/reopening/editing/deletion, category creation, item refresh persistence,
field hide/restore, generic/specific switching, applying layouts to existing
items, template replacement, blank creation/network failure, stale drafts, and
navigation cleanup at narrow width. Browser workflows discover both spec files.

The local Playwright runner cannot launch Chromium under this execution
sandbox (`socket() failed: Operation not permitted`); browser downloads are also
blocked. This is an environment failure, not a passing or failing application
test result. A separate browser preview exercised the real API handlers against
isolated synthetic storage: template creation/edit/reopen, category right-click
creation, saving/reopening a part, generic conversion followed by Save/refresh
and restored supplier values, and two-editor revision conflict with draft
retention were observed through the UI. The preview never contacts production R2.

## Remaining limits and follow-up

- Full browser regression execution requires CI or a machine where Chromium can
  start. Existing browser tests predate the current instruction/container UI;
  treat CI results separately from Node checks and the observed preview flows.
- Full desktop/narrow-screen visual parity across every Part, Subassembly,
  archive and instruction state needs further browser comparison. CSS cleanup
  is limited to the known duplicate disclosure-header rules.
- Production Cloudflare routing, real R2 conditional-write behavior, deployed
  asset freshness, deployment gates, and offsite backup recovery are not proven
  by synthetic tests. No deployment success is claimed by this document.
- Whole-index storage still has bounded three-attempt optimistic retries. It is
  sufficient for this targeted repair; no database or distributed lock service
  was introduced.
- Existing multi-step project archive/import transactions and AI quota races
  described in the November 20 infrastructure review remain separate work.
