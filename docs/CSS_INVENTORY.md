# Current CSS inventory — November 26, 2026

The retired override cascade is removed. These are source byte totals and per-file gzip estimates, not captured network transfers. Shared files are counted once per page.

| Page | Stylesheets | Source bytes | gzip bytes | `!important` |
| --- | ---: | ---: | ---: | ---: |
| project.html | 10 | 62531 | 16751 | 10 |
| workshop.html | 7 | 45360 | 12689 | 10 |
| knowledge.html | 8 | 45049 | 12509 | 8 |
| website-settings.html | 4 | 28987 | 7947 | 1 |

Shared tokens and component owners are described in [UI_STANDARDS.md](UI_STANDARDS.md). The strict producer check spans every current HTML entry and reachable browser module; code-built classes need a documented narrow allowance. Retired selectors are removed with their producers, preserving live selector alternatives. Remaining exceptions have fixed budgets; removal does not authorize specificity growth.
