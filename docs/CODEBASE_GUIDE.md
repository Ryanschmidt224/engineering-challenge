# Building Schmidt — Codebase Guide

This document is the starting point for a human developer reading or changing the website.

## Fast orientation

This is a plain JavaScript / HTML / CSS site deployed on Cloudflare. There is **no bundler**. Browser scripts are loaded in the order specified at the bottom of `index.html`. Cloudflare Pages Functions in `functions/api/` handle requests; `worker.js` handles routing where configured. Project records are stored separately from Git source code. Git commits **do not** back up the data in project storage.

### What lives where

| Area | File | Responsibility |
| --- | --- | --- |
| HTML and load order | `index.html` | Navigation and page scaffolding; includes browser scripts |
| Site entrypoint | `assets/site.js` | Main navigation, learning tiles, admin/login, photo setup, controller initialization |
| Assembly and workspace | `assets/site-assembly.js` | Canonical assembly tree, workspace, BOM, part-detail and photo-storage workflows |
| Part/component editor | `assets/site-assembly.js` | BOM component editor, review/save flow and component API integration |
| Shared photo controls | `assets/photo-editor.js` | Pencil launcher and modal dialog shell reused for parts and assemblies |
| Pure BOM selector | `assets/bom-model.js` | Assembly descendants, visible purchased parts vs shop stock, quantity/assembly display labels; no browser or storage dependencies |
| Recipes / work instructions | `assets/recipe-editor.js` | Discrete instruction steps, editing, local recipe UI state |
| Workshop | `assets/resources.js` | Shared reference resources and Workshop category tree |
| BOM selection | `assets/library-part-picker.js` | Choosing library/Workshop parts |
| Drawings and part files | `assets/drawings.js`, `assets/part-files.js` | Drawing attachments and files |
| Shared calculation rules | `assets/engineering-core.js` | Pure domain functions, portable outside browser |
| Local project and recovery | `assets/local-project.js`, `assets/archive-check.js` | Local project support and archive validation |
| Site styles | `assets/theme.css` and four ordered `site*.css` files | Palette variables and cascade-preserving UI styles |
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
  ├─ photo-editor.js       shared photo pencil and modal
  ├─ site-assembly.js      canonical assembly/workspace/BOM controllers
  └─ site.js               controller bootstrap, login, navigation, resources

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
1. Start in `assets/site-assembly.js` and find `renderWorkspaceParts` or the BOM rendering code.
2. Style the table using the ordered site CSS files; edit `assets/theme.css` for colors.
3. Change filtering/quantity labels in `assets/bom-model.js`, then run `tests/bom-model.test.mjs`.
4. Confirm both thumbnail and list views, nested assembly quantities, and the standard shop-materials section.
5. Do not alter quantities or persistent records for a purely visual change.

### Change part details or part editing
- Workspace part detail display: `assets/site-assembly.js`.
- Component edit/review/save controller: `assets/site-assembly.js`.
- Server writes/validation: `functions/api/components.js`; workspace data: `functions/api/workspace.js`.
- Always distinguish display-only values from saved data and generated BOM entries.

### Change work-instruction steps
- Main editable recipe UI: `assets/recipe-editor.js`.
- Workspace mounting and data loading: `assets/site-assembly.js`.
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

## Current architecture and remaining debt

Assembly and part management now lives in `assets/site-assembly.js`, loaded after
`assets/photo-editor.js` and before `assets/site.js`. This is one canonical
controller, not two copies. Its large closure remains intact because its
callbacks share state; the Playwright browser test guards its initialization.

CSS is divided into four sequential stylesheets to retain the established
cascade, with all palette colors in `assets/theme.css`. Their order matters.
Future cleanup can consolidate overlapping selectors after visual regression.

Part photo and assembly photo editors now share pencil and modal UI controls.
Their storage adapters remain separate because their API endpoints differ.
No persistent data, photo IDs, part identities, or API formats were changed.

Remaining work: explicit dependency injection between scripts, gradual
extraction of tree/BOM/workspace logic, and browser tests for persistence,
archived revisions and restoration.

## Publishing

GitHub `main` is the source branch. Cloudflare's production deployment depends on the site's configured build/integration. Confirm its status separately. A deployment should not modify stored project records merely because code was reorganized.
