# CSS inventory and migration boundaries

The detailed component specification is [UI_STANDARDS.md](UI_STANDARDS.md). This inventory measures the proposed CSS foundation batch against production baseline f73e021. It is not a claim that the main page has been rebuilt or that every unmatched selector is dead.

## Loaded CSS

Sizes are bytes, not rounded KB. Compressed totals sum gzip output for individual stylesheets; these are repeatable estimates, not captured transfer sizes.

| Page | Stylesheets | Uncompressed before → after | gzip before → after | !important before → after |
| --- | --- | --- | --- | --- |
| `index.html` | 12 | 586,048 → 523,578 | 90,339 → 83,741 | 738 → 666 |
| `workshop.html` | 5 | 21,082 → 25,345 | 6,309 → 7,257 | 0 → 0 |
| `knowledge.html` | 5 | 19,614 → 23,877 | 5,902 → 6,848 | 0 → 0 |

The shared header and toolbar definitions add a small amount to the module pages while eliminating separate header implementations. The four legacy stylesheets still exist; remaining excess is not hidden by new override layers.

## Ownership

- Theme colors, geometry and documented breakpoint values: theme.css.
- Site header, control, section, section-action and status-indicator definitions: ui-kit.css. Header markup: site-header.js, an ES module with explicit initSiteHeader().
- Module-page list cards and field rows: components.css; page layout stays in family-workshop.css and knowledge.css.
- Empty sections communicate once through their zero count. Feedback errors and editors remain visible when needed.
- Project summary uses the same collapsed section headers/body spacing. Photo, summary, cost, BOM, tools and milestone handlers retain their existing storage contracts.

## Removal evidence and guardrails

The isolated dead-rule commit removes 359 selectors and 49,202 bytes. Its curated list is scripts/css-retired.json. The dry-run-first pruning script removes only selectors with a required retired class, keeps live branches of mixed selector lists and leaves ambiguous pseudo-selector cases alone. It refuses exact application references reintroduced after review. It is not a blanket unused-class detector.

Additional superseded header, toolbar and section-frame selectors are removed when the shared definition takes ownership. Legacy freeze hashes and specificity ceilings are updated downwards in scripts/css-baseline.json. No new !important rules or project-ID selectors are introduced.

See FEATURE_INVENTORY.md for feature-preservation scope and CSS_MIGRATION.md for pending screenshot requests and rollback. The owner requires Claude review before this batch is merged or deployed.
