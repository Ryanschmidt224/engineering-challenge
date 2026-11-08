# Building Schmidt — Codebase Guide

This document is the starting point for a human developer reading or changing the website.

## Fast orientation

This is a plain JavaScript / HTML / CSS site deployed on Cloudflare. There is **no bundler**. Browser scripts are loaded in the order specified at the bottom of `index.html`. Cloudflare Pages Functions in `functions/api/` handle requests; `worker.js` handles routing where configured. Project records are stored separately from Git source code. Git commits **do not** back up the data in project storage.

### What lives where

| Area | File | Responsibility |
| --- | --- | --- |
| HTML and load order | `index.html` | Navigation and page scaffolding; includes browser scripts |
| Site entrypoint | `assets/site.js` | Main navigation, learning tiles, admin/login, photo setup, controller initialization |
| Assembly and workspace | `assets/site.js` | Assembly tree interactions, workspace rendering, BOM views, part-detail UI (currently a large controller) |
| Part/component editor | `assets/site.js` | Component editor form, review and save flow, component API interaction (still in the main script) |
| Pure BOM selector | `assets/bom-model.js` | Assembly descendants, visible purchased parts vs shop stock, quantity/assembly display labels; no browser or storage dependencies |
| Recipes / work instructions | `assets/recipe-editor.js` | Discrete instruction steps, editing, local recipe UI state |
| Workshop | `assets/resources.js` | Shared reference resources and Workshop category tree |
| BOM selection | `assets/library-part-picker.js` | Choosing library/Workshop parts |
| Drawings and part files | `assets/drawings.js`, `assets/part-files.js` | Drawing attachments and files |
| Shared calculation rules | `assets/engineering-core.js` | Pure domain functions, portable outside browser |
| Local project and recovery | `assets/local-project.js`, `assets/archive-check.js` | Local project support and archive validation |
| Site styles | `assets/site.css` | Page layout, individual feature styling, responsive behavior |
| API controllers | `functions/api/*.js` | Cloudflare-backed data reads, writes, and archive endpoints |
| Source-level tests | `tests/*.test.mjs` | Behavior checks, API simulations, structural assertions |
| Data design | `docs/DATA_ARCHITECTURE.md` | Target model and backup/migration constraints; NOT a statement that all targets are implemented |

## How browser code connects

```text
index.html
  ├─ feature services: resources, drawings, library-part-picker,
  │                   engineering-core, local-project, archive-check,
  │                   part-files, recipe-editor
  ├─ bom-model.js          exports BSBomModel (pure BOM selectors)
  └─ site.js               defines/initializes assembly and component controllers,
                           login/photos, resources and navigation

User interaction
  └─ assembly/workspace/part editor
       ├─ calls browser-side helpers and feature modules
       ├─ GET/POST/other methods to /api/tree, /api/components,
       │  /api/workspace and related endpoints
       └─ Cloudflare endpoint reads/writes project data
```

**Important:** These are ordinary classic browser scripts sharing a global lexical environment, not isolated ES modules. Loading order matters. The extracted controller declarations are evaluated before the app calls them; do not add side effects at file load. Avoid adding more implicit cross-file globals. For a substantial future refactor, pass dependencies explicitly into feature initializers and convert to ES modules with tests.

## Common change paths

### Change BOM list layout or behavior
1. Start in `assets/site.js` and find `renderWorkspaceParts`, `bom-shopping-table`, or `listView`.
2. Style the table with `assets/site.css` rules for `.bom-shopping-table`; discrete row colors live at the bottom of the stylesheet.
3. Change filtering/quantity labels in `assets/bom-model.js`, then run `tests/bom-model.test.mjs`.
4. Confirm both thumbnail and list views, nested assembly quantities, and the standard shop-materials section.
5. Do not alter quantities or persistent records for a purely visual change.

### Change part details or part editing
- Workspace part detail display: `assets/site.js`.
- Component edit/review/save controller: `assets/site.js`.
- Server writes/validation: `functions/api/components.js`; workspace data: `functions/api/workspace.js`.
- Always distinguish display-only values from saved data and generated BOM entries.

### Change work-instruction steps
- Main editable recipe UI: `assets/recipe-editor.js`.
- Workspace mounting and data loading: `assets/site.js`.
- Data structure contract: `docs/DATA_ARCHITECTURE.md`.
- Avoid bringing back obsolete blank instructions fields; steps should reveal optional fields only when needed.

### Change workshop resources
- `assets/resources.js` for Workshop categories/reference data.
- `assets/library-part-picker.js` for selecting items for a BOM.
- `functions/api/purchased-parts.js` for purchased-part persistence.
- A reference link is not automatically a new BOM quantity.

### Change backups
- `functions/api/project-archive.js`, `archive-staging.js`, `automatic-backups.js` and `assets/archive-check.js`.
- Read `docs/DATA_ARCHITECTURE.md` first. **Never** treat a source-code rollback as restoring project data.
- Make no destructive data migrations as part of a UI or organization refactor.

## How to run checks

From the repository root:

```sh
npm run check
```

This includes syntax checking of the site scripts and Node's test suite. A separate GitHub Actions browser regression runs Playwright with mocked project data, confirming feature-tree navigation and the BOM's distinct list rows. The tests are useful safeguards but **not proof** that every browser workflow works. After modifying UI, manually verify login/admin, project navigation, assembly expansion, BOM display, opening a part, saving part details, recipes, drawings, and project backup/download. Verify the Cloudflare deployment build status before reporting live deployment success.

## Maintenance rules

1. Keep browser feature logic separate from server data validation.
2. Record new features in this guide with an entrypoint, data ownership, and dependencies.
3. Make small, reviewable changes with tests; avoid broad string-replacement changes without checking every match.
4. Give saved entities stable IDs. Don't infer identity from a displayed name.
5. Preserve historical project records. Never silently migrate or discard storage formats.
6. Document an intentional dependency in code or this guide rather than relying on unexplained calls across files.
7. Put new pure calculations in `engineering-core.js` (or another testable pure domain module), not inline in DOM handlers.
8. New tests should assert observable behavior where practical, not only that source text contains a phrase.

## Known architectural debt

A previous broad source-file extraction was reverted after a production startup failure. The current implementation uses a **conservative pure-function extraction** for BOM selection only, not a full modular redesign. In particular, `site.js` still contains a very large `setupAssemblyTrees()` closure with nested UI and data-flow logic. Breaking up that closure safely requires:
- naming its state and passing dependencies explicitly;
- extracting pure assembly/BOM calculations and unit-testing them;
- isolating tree navigation, workspace UI, part details, and persistence;
- creating browser integration tests for add/edit/delete, reload, and nested assemblies.

The single `site.css` file also contains multiple generations of related style rules; a future CSS organization pass can consolidate selectors after visual regression testing.

Do not split this large closure through arbitrary text boundaries: its nested callbacks share variables. Prefer one measured seam at a time.

## Publishing

GitHub `main` is the source branch. Cloudflare's production deployment depends on the site's configured build/integration. Confirm its status separately. A deployment should not modify stored project records merely because code was reorganized.
