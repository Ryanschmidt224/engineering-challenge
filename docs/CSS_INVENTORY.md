# CSS cleanup: first batch

This batch preserves the deployed appearance. It formats all 13 stylesheets with pinned Prettier 3.6.2 and removes only earlier exact duplicate declarations in the same file, selector and conditional context. Different values, fallbacks, selector groups and keyframes remain intact. No selectors, markup, storage or APIs are renamed.

Removed 153 exact duplicate declarations and 19 resulting empty rules. Eight duplicate `!important` declarations are removed. Existing freeze hashes are refreshed for this reviewed cleanup; the allowed specificity ceilings are reduced, never raised. Formatted source grows in line count because declarations are readable on separate lines; raw line count is not a correctness target.

## Stylesheet inventory

| File | `!important` before → after | Project-ID mentions before → after |
| --- | --- | --- |
| `components.css` | 0 → 0 | 0 → 0 |
| `dialog-system.css` | 11 → 11 | 0 → 0 |
| `family-workshop.css` | 0 → 0 | 0 → 0 |
| `parts-management.css` | 16 → 16 | 0 → 0 |
| `photo-markup.css` | 53 → 53 | 0 → 0 |
| `photo-viewer.css` | 0 → 0 | 0 → 0 |
| `product-lookup.css` | 1 → 1 | 3 → 3 |
| `site-controls.css` | 159 → 159 | 374 → 374 |
| `site-polish.css` | 475 → 467 | 78 → 78 |
| `site-workspaces.css` | 12 → 12 | 91 → 89 |
| `site.css` | 55 → 55 | 0 → 0 |
| `theme.css` | 0 → 0 | 0 → 0 |
| `unstructured-notes.css` | 6 → 6 | 0 → 0 |

## Workspace header ownership found in this audit

| Component | Current owners | Next consolidation boundary |
| --- | --- | --- |
| Part details summary | `site-workspaces.css`, `site-controls.css`, `site-polish.css` | `.part-details-view-heading`, title/count/edit action, open/closed state |
| Work Instructions | `site-polish.css`, existing base/workspace rules | `.recipe-heading-row`, `.recipe-disclosure-toggle`, title/count; keep editing logic intact |
| Helpful tools / archive / revision summaries | `site-controls.css`, `site-polish.css` | `.workspace-primary-disclosure`, `.workspace-secondary-disclosure`, `.assembly-archived-disclosure` |
| Unstructured Notes | `unstructured-notes.css`, `site-polish.css` | `.bs-unstructured-notes-heading`; retain its use outside project workspaces |
| Nested instruction archives | `site-polish.css` | `.investigation-collapse-heading`; empty/open/closed/step-editing states |
| Workshop panels and headings | `components.css`, `family-workshop.css` | Shared controls already isolated from the legacy cascade |

The existing 48px header geometry is still defined by several late rules and includes `!important`. This batch does not claim that the final component migration is complete. Consolidating those rules is a separate reviewed batch after these visual baselines pass. Keep minimum heights, title wrapping, counts, action visibility, keyboard focus and chevron alignment in the acceptance cases.

## Validation and rollback

`browser-css-regression.spec.mjs` compares candidate screenshots with CSS read from deployed source commit `1ed47284dcea58bdadb4f86b4065e3746fa2995d`, using identical fixture APIs and browser contexts. It covers all three built-in project layouts plus a personal project, part/assembly workspaces, 1440px/390px widths, collapsed and expanded states plus the part-edit dialog. Both image sets are retained as CI artifacts. The baseline is derived from the fixed older commit, not regenerated from candidate CSS.

Existing Node and application browser workflows remain required. Source assertions are made whitespace-tolerant without weakening their layout/property checks. CI installs the pinned formatter and checks formatting plus existing specificity/freeze guardrails.

Rollback is a code-only revert to the previous authenticated release. No D1 schema, R2 files, project records, authentication or deployment bindings are changed. Backup work is paused at the owner’s request.
