# BuildingSchmidt UI standards

These rules keep every screen looking and behaving the same. They apply to new work immediately and to old screens as each one is migrated.

## One source for each thing

| Thing | Defined in | Used by |
| --- | --- | --- |
| Colors, spacing, type sizes, radii, control and header heights | `assets/theme.css` (tokens only) | everything |
| Page basics for the standalone pages (body text, headings, links, focus ring) | `assets/base.css` | `workshop.html`, `knowledge.html` |
| Shared components: section, button, control, chip | `assets/ui-kit.css` (CSS) and `assets/ui-kit.js` (`window.BSUI`) | every page, including the legacy project pages |
| Components of the standalone pages (field rows, panels, tables, dialogs, list cards, status bar) | `assets/components.css` | `workshop.html`, `knowledge.html` |
| Page layout only | one small file per page (`family-workshop.css`, `knowledge.css`) | that page |

A page never restyles a shared component. If something needs to look different, add a named variant to the component, in its own file.

## Rules

1. **Build with the helper, not by hand.** Collapsible sections come from `BSUI.section()`, buttons from `BSUI.button()` (or the same classes in markup). Do not create another `<details>` + `<summary>` + `<h2>` + count structure by hand.
2. **Use tokens.** Sizes, spacing, colors and radii come from `theme.css`. No raw pixel values in component or page CSS except a documented one-off layout dimension.
3. **No `!important`, no ID selectors, low specificity.** One class per selector where possible. CI fails if `!important` or project-ID selectors increase.
4. **No new rules in the frozen legacy files** (`site-polish.css`, `site-controls.css`, `site-workspaces.css`). Migrating a component may delete its old rules from them; refresh `scripts/css-baseline.json` in the same reviewed change.
5. **Shared prefix on legacy pages.** On `index.html` shared components use the `ui-` prefix, because the legacy markup already uses bare names such as `status`, `actions`, `panel` and `button` for other things.
6. **Text is text.** Build UI with `textContent`/DOM nodes; never insert user text with `innerHTML`.

## Components

### Section (`BSUI.section`)
Every collapsible block on project, assembly and part pages: Part details, Work instructions, Helpful tools, History, Archived items, Notes, Project backups, Recent changes.

Part **Revisions** is a separate section at the bottom of the part page. **Create a Revision** opens one optional metadata prompt: What changed, Why did you change it, Notes, and the shared choose/paste/drop uploader with thumbnails and photo names. **Save revision** captures the saved part plus this explanation and photos; it does not open the part-details editor. Cancel and failed saves preserve the appropriate draft boundary, dates stay automatic, and identical retries reuse their operation ID. Each saved revision appears once as a shared chevron disclosure. Its header shows the revision label, saved date and What changed; expansion shows the saved details. There is no duplicate table/View row. The group shows the working revision separately and counts saved copies only. A saved copy keeps the previous revision number; the working part advances once. New numbering starts at Revision 1; older unnumbered historical copies are labeled Earlier copy. Full saved details expand through the existing shared section. Edit part details offers Save and Save as revision, with keyed tooltips explaining overwrite versus preserving the previous version. Save keeps the revision number; Save as revision prompts for explanation/photos, captures the old saved state, and commits the edits as the next revision. **History → Archive** in an assembly lists items removed through the tree’s **Archive part** / **Archive subassembly** context actions. There is no competing Delete menu item. Archived parts and subassemblies retain their permanently consumed numbers; restoring an item retains its original number. Older archived entries remain readable; their former record-archive controls are removed. These are legacy-flow refinements; aligning the separate D1 project preview remains pending.

- One frame: surface background, 1px border, large radius, the same vertical gap between sections.
- One header: at least 48 px (`--section-height`), chevron on the left (6 px, 1.5 px stroke, rotates when open), title 16 px semibold, record count in parentheses 14 px muted, optional help or actions on the right. The header grows when the title wraps; it never clips.
- One body: the same inner padding. Communicate emptiness once: a zero header count needs no duplicate message. Otherwise provide one concise guidance line. Preserve loading and error feedback.
- Variant `ui-section--quiet` (no frame) for secondary, utility sections such as Project backups and Recent changes.
- Project summary content sections use this same header and body and start collapsed. Existing editable fields stay inside the body. A zero record count already communicates emptiness; do not repeat it with “No notes yet”. Preserve loading and error feedback.

### Site header
- `assets/site-header.js` exports one explicit `initSiteHeader()` entry point, called by each page. `ui-kit.css` owns branding, navigation, current-page appearance, Account control and responsive layout.
- Navigation order is Projects, Knowledge, The Workshop, Calculators. Account stays available on every page. Standalone pages link to the existing account dialog on Projects.
- Use the documented narrow/wide breakpoint values in `theme.css` as layouts migrate. Native media queries use literal values, not `var()`.

### Tooltip interaction
- Hover help waits 650 ms and cancels when the pointer leaves, on pointer-down, scroll or Escape. Keyboard help remains immediate.
- Do not put a long drag instruction on every tree row. Use the explicit feature-tree help control. Indicators precede the item text and are not editable checkboxes.

### Section actions (`BSUI.sectionActions`)
- The action row is the first element inside the expanded section body, aligned with its standard padding.
- "+ Add entry" uses `BSUI.button`, appears first, and uses the small 32px section-action height. Secondary actions follow on the same wrapping row.
- Pass callbacks/buttons from each controller; controllers retain their permission and edit-mode rules. Do not add section-specific offsets or restyle the buttons.
- Re-rendering reuses the direct action slot. Read-only sections have no empty action strip.

### Button (`BSUI.button`, classes `ui-button` / `button`)
- Page toolbars and search controls use `--control-height` (44 px). Actions inside shared sections/panels use `--control-height-small` (32 px), inherited through the shared action-size variables; `--small` explicitly chooses the same variant.
- Variants: default (outlined), `--primary` (filled, one per area), `--quiet` (text only), `--danger`.
- Same font size (14 px semibold), radius (`--radius-medium`) and padding everywhere.

### Control (`ui-control`)
Text inputs, search boxes and selects in toolbars match the button height, radius and font size so a row of controls lines up.

### Chip (`ui-chip`)
Tags and filter chips: pill shape, 14 px, one height.

### Tooltips and help
Follow the tooltip plan: icon buttons get short labels; concepts get a "?" help tip; real warnings stay visible. Help text lives in one file.

## Checking
- Screenshot comparisons (`tests/browser-css-regression.spec.mjs`) at 1440 px and 390 px for every changed screen.
- `tests/ui-standards.test.mjs` checks that pages load the shared files and that migrated screens use the helper.

### Selectable list cards

Selectable rows use `listCard()` and `.list-card`, with title, metadata and summary stacked at the full available width. Action buttons use `button()` and `.button`. Do not combine these classes: their layout and text hierarchy have different purposes. Both retain native keyboard focus and activation.

### Information tiles and field rows

`BSUI.informationPanel()` supplies one static title/body shell and `BSUI.fieldRow()` one label/value row. Reference and project information use identical borders, typography, padding and label widths. They stack within Part details; narrow screens stack each label above its value. Container names are ordinary read-only text rather than editable-looking inputs. Purpose editing and alternative selection keep revision checks and preserve drafts on failed saves.

### Adjustable task panes

Workshop and Knowledge use assets/split-panes.js, explicitly initialized per page, with one shared ui-pane-resizer style. Drag, Left/Right, Shift+Left/Right, Home and End resize the preceding list. Double-click resets that column; Escape or pointer cancellation restores the width before dragging. Widths persist only in this browser, separately for each page. Layout bounds keep lists usable and reserve detail space. Workshop categories move above the family/detail columns at 1024 px; all panels stack and dividers leave the tab order at 640 px. Disabled/corrupt storage falls back to defaults. Default list widths belong to page layout; shared minimum/maximum and handle geometry belong to theme.css.


## Migration and rollback

### Project views

Project directory views share one card renderer and `project-directory.css` layout. Details, List and Tiles use the same name, keyboard activation, project route and summary-album thumbnail. View is a browser preference; sorting and descriptor/search filters work in each view. List/Tiles omit secondary text visually; Details labels the recorded timestamp Created. Tiles uses the former Large icons layout; the former horizontal Tiles layout is removed. Saved Large icons preferences map to Tiles. Calculators uses the same renderer and descriptor filter controls, with its own view preference and alphabetical sort choices because calculator publication dates are unavailable. No fabricated modification dates or separate catalog-cover field.

Use shared headers, section disclosures/body spacing, information panels and field rows, controls, dialogs and pane resizers. Tooltip hover waits 650 ms and cancels on pointer-down, scroll, exit or Escape; tree help belongs on an explicit control. A leading status mark is an indicator, not a checkbox. Empty sections communicate their count once. Summary sections remember browser-local open state and start collapsed. Workshop and Knowledge column widths are browser preferences; phones stack panels. These presentation preferences are not engineering data.

Remove replaced rules at their original owner. Strict producer checks follow loaded modules and allow only documented computed class patterns; literal matches are conservative evidence, not proof every state is reachable. Do not delete classes based on text absence alone. Legacy CSS budgets may decrease, never grow. Shared-page CSS must use the standard breakpoints. Rollback a presentation batch by reverting and deploying its HTML, JS and CSS together; no data reversal is needed. Former CSS migration progress notes are superseded by these standards and the current feature inventory.

## Current owner review requirements

Presentation guidance belongs in the shared help tooltip or is removed. Keep errors, conflicts, status messages and confirmation dialogs visible. Empty content gets at most one short line or its zero count. Workshop/Knowledge panel help is keyed in `interface-help.js` and uses the existing shared tooltip, including keyboard access, delayed hover and dismissal. Saved descriptions, field values, notes and record text are engineering content, not guidance to hide.

The shared `ui-page` container owns the full-width gutter for the header inner, page title and first task column. Page layouts must not add a separate centered maximum width or horizontal padding. Page headers contain the title alone, without an eyebrow or explanatory subtitle. Workshop/Knowledge detail panels are blank until a selection is made; loading, failures and conflicts retain their feedback.

The owner handoff is reconciled against the newer choices as follows:

- PR #68 already implements the three directory views and searchable Calculators. Do not recreate its work or remove calculator topic filters when project tags are retired.
- PR #67 fixes the missing-photo requests and now keeps parts readable on metadata failures. Do not add a second photo-presence marker.
- Part Revisions stays separate at the page bottom, with Archive in the parent's History. The handoff's suggestion to fold Revisions into History is superseded by the owner's later explicit choice. Current state is a working draft; historical copies remain fixed. Count saved copies as `saved`, excluding the current row.
- Engine-only UI work starts after the existing foundation/custom-part/revision/assembly PRs have their targeted reviews and are integrated. This shared presentation batch does not add another engine feature PR or rebuild legacy part/settings pages.

Required engine work, grouped by the relevant feature owner:

| Area | Required behavior |
| --- | --- |
| Summary and milestones (#1–3) | A token sets the summary photo to about 70% of the old height; preserve gallery behavior. Stack BOM and Tools as full-width sections. Intent/milestone help moves to tooltips; empty sections have compact actions and no redundant paragraphs. |
| Identity and header (#4–6) | Quantity matches Status controls/labels and remains in both header and details. Show number plus canonical name, with the full name on hover. Remove the separate live tree-name field; never rewrite an applied migration. One shared adjustable 20-character part/subassembly-name limit, counter and validation; exclude project/top-root, Workshop product and manufacturer numbers. Grandfather existing names without truncation, requiring shortening when renamed. Workshop copy asks for a valid project name. Include the over-limit Parts Management filter. Restore and historical-format compatibility must preserve prior evidence rather than silently truncate or rewrite fixed snapshots. |
| Part sections (#7–10) | Small supplier/Copy to Workshop actions on one row; keyed help. Alternatives becomes an ordinary expandable field row, without nested frames. Small Add/Create a Revision actions; revision guidance is a tooltip and counts say saved. Preserve What changed/Why/Notes/photos and both Save behaviors. |
| Parts Management (#14) | Compact, read-only number/name/value/quantity/status list; number/name opens the part. Browse filters sit left. Full columns remain read-only, hide Browse and move category to the toolbar. Explicit Edit enables inputs. Remember compact/full preference; use the shared status marks. No separate tree-name column or redundant Project back button. |
| Project settings (#15) | One column: General, Part numbering, then a separate danger section. Small Save actions, help in tooltips, no nomenclature list. Do not rebuild project tags; retain existing legacy tags until cutover. |
| Helpful tools (#17) | Calculator and Tool only. Legacy hides new Workshop-part choices but keeps saved references visible/removable. Engine tools come from D1 Workshop with stable IDs, last-known names and archived-source labels; links never add BOM/cost/tree quantities. See the History plan for recovery/cutover acceptance. |

Do not silently rename, merge or change manufacturer/order codes in existing projects based on the handoff's dated data examples. Those are owner data edits, not this presentation change.

The owner subsequently authorized a narrow presentation refinement on the current part page: Alternatives uses the shared `fieldDisclosure`/field-row layout with a part count and keyed help, replacing the nested section. The current legacy command still creates and selects atomically, so its final action is accurately labeled **Add and select alternative**. The engine's later workflow separates **Add alternative** from **Select…** and requires the guarded confirmation described in the engine plan. This presentation change does not claim that legacy alternatives already isolate all project notes/files.

The current alternative selector is labeled **Select Alternative**, as explicitly requested by the owner.


The latest revision-display preference supersedes the earlier table request: use one chevron entry per saved copy with date and What changed in the header. Counts say `saved`; the working level is group metadata. Preserve all snapshots and saved numbers; this removes duplicate presentation, not stored records. Align the gated engine preview with this preference when its stack is integrated.

Active and archived record cards use `BSUI.section` for identical header typography, padding and chevrons. Their shared small Edit action stays in the header; the archived record's destructive action sits inside its expanded body so it cannot enlarge the header. No custom archived-header style or extra record shell is retained.


### Density by control purpose

Use the shared navigation, toolbar and table control-height tokens instead of per-page button sizing. Desktop navigation lists and toolbar/table actions use 32 px targets with 2 px list gaps and 8 px toolbar gaps. Primary form actions retain the standard 44 px target. Small screens and coarse pointers raise navigation/toolbar/table targets to 44 px. Use `ui-navigation-list` for page links, category lists and instruction lists. Toolbar field rows keep label and input together with no form-row margins; stack paragraphs must not add a second vertical gap.

The project tree puts Generic Part Name and issued number on one row. Specific Part Name remains the physical component name. The visible Add menu supports keyboard/touch discovery; right-clicking the project or an assembly offers the same creation choices. Show the first-use right-click hint once per browser, without blocking the editor. Drag/drop uses the existing guarded reorder/move commands and rejects descendant cycles. Keep menu-based move actions available.


## Label/value proximity

Both shared field-row components use theme-owned --field-label-width (maximum 9rem) and --field-label-gap (12px). Label columns can shrink in narrow panels but do not grow with a wide screen. Project pages and dialogs inherit these rules instead of imposing percentage widths; phone layouts retain their stacked rows. Pane navigation, image columns, data tables and multi-field calculator groups are not label/value rows and retain their own layout rules. Retained legacy forms already use bounded widths (including 140px record-entry labels); their frozen screen layouts remain separate.

## Shared photo completion and section edits

Photo tools include an explicit Save action that closes the tools. Uploads still save through each owning component's guarded upload flow; closing tools does not cancel or re-upload files. The unfilled pencil stays below the photo and aligns with the displayed image/gallery's right edge. Shared geometry tracking releases controls when their page/dialog is removed.

Disclosure-section edit actions use `sectionEdit` in the header's right-hand action slot and are visible only while the section is expanded. Creating a new record remains an action within the body. Summary, cost estimates and existing original intent use this shared helper.

Project tags are selected from discrete choices managed in Website settings. Project owner labels and the default for new projects live there too; neither is an authorization role. Removing or renaming a choice preserves the labels on existing projects and historical copies. Original intent asks for the goal and success criterion; the redundant plan input is removed while saved plan text remains available in intent versions.
