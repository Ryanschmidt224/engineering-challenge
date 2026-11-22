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

- One frame: surface background, 1px border, large radius, the same vertical gap between sections.
- One header: at least 48 px (`--section-height`), chevron on the left (6 px, 1.5 px stroke, rotates when open), title 16 px semibold, record count in parentheses 14 px muted, optional help or actions on the right. The header grows when the title wraps; it never clips.
- One body: the same inner padding. Empty sections say so in one muted line.
- Variant `ui-section--quiet` (no frame) for secondary, utility sections such as Project backups and Recent changes.

### Button (`BSUI.button`, classes `ui-button` / `button`)
- One height (`--control-height`, 44 px) for every button and form control in a toolbar; `--small` (32 px) for in-row actions.
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
