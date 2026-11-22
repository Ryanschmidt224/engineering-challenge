# Shared CSS standards

The owner prefers consistent text, spacing and graphics over exact reproduction of the old cascade. This batch deliberately normalizes near-identical values to shared theme tokens, after making all 13 stylesheets readable and removing 153 exact duplicate declarations / 19 empty rules. Eight duplicate `!important` declarations are removed; specificity ceilings are lowered, not raised.

## Intended appearance

| Element | Standard |
| --- | --- |
| Caption / secondary text | 12px / 14px |
| Body and workspace section titles | 16px |
| Lead / section title / page title / display | 18px / 22px / 28px / 36px |
| Font weights | 400 normal, 600 semibold, 750 bold |
| Spacing scale | 4, 8, 12, 16, 24, 32, 48px |
| Corners | 4, 8, 12px; pills and circles retain their purpose |
| Workspace headings | Minimum 48px, content-driven height when labels wrap |
| Heading counts | 14px |
| Disclosure graphics | Shared 6px chevron / 1.5px stroke and common inset tokens |

Explicit CSS text sizes/weights, gaps, near-identical corner radii and workspace-heading padding use the shared scale. Purposeful layout dimensions, responsive calculations, photo dimensions and margins remain local. Embedded JavaScript styles and font shorthands are outside this batch. This makes deliberate visual changes; exact screenshot equality is not an acceptance requirement.

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

Header ownership remains distributed, with shared values now supplied by theme tokens. A later component migration can remove competing rules using this inventory. Retain title wrapping, counts, action visibility, keyboard focus and chevron alignment.

## Validation and rollback

`browser-css-regression.spec.mjs` captures old and new renderings using CSS from fixed deployed source `1ed47284dcea58bdadb4f86b4065e3746fa2995d`. Identical fixtures cover three built-in projects and a personal project, part/assembly workspaces, 1440px/390px widths, collapsed/expanded states and the part-edit dialog. Both image sets are retained in CI as evidence of intentional differences.

Acceptance checks require readable standard title/count sizes, headings at least 48px tall, no clipped header contents, no horizontal page overflow, working disclosures/edit dialogs and no browser errors. Keyboard-focused Helpful tools help must stay within the viewport and dismiss with Escape. Hidden section tooltips use `display: none` so they cannot widen phone pages. Existing project/Workshop workflows and Node checks remain required. Source assertions tolerate formatting and refer to the shared radius token. CI checks pinned formatting plus the existing specificity/freeze guardrails.

The underlying header rules still occur in several files; consolidating ownership is a later bounded batch. Do not claim that all override files or `!important` rules have been removed. This batch establishes common values while retaining existing application behavior.

Rollback is a code-only revert to the previous authenticated release. No D1 schema, R2 files, project records, authentication or deployment bindings change. Backup work is paused at the owner's request.
