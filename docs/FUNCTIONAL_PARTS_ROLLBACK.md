# Functional Parts — Architecture, Rollback and Release Notes

## State

The functional-part redesign has been committed to `main`. The user explicitly
accepted that existing project data is disposable while the architecture is
being rebuilt; the old project format must **not** constrain the new schema.
The current visual layout, feature tree, Workshop, and existing Work Instruction
controls should remain familiar.

## Recovering the pre-redesign website code

- Repository: `Ryanschmidt224/engineering-challenge`
- Exact pre-change commit: `b1d628794e8944dc7eef0e726f71f98db18f36ec`
- Reference branch: `backup-before-functional-parts-2026-11-20`
- Development branch: `feature/functional-parts`
- Live source branch: `main`

To roll back code, redeploy the exact checkpoint commit (or reset `main` to
the snapshot via a reviewed Git ref update). Do not delete the reference
branch. Restoring a previous commit does **not** reverse Cloudflare R2 writes.
Code rollback and data rollback are different operations.

No full, verified project-data backup was created as part of this change.
This was an explicit tradeoff. Pre-change project records can be reset or
re-created if incompatible; never claim they were restored. The site still
has optional project export utilities for anyone who wants data preservation.

## Canonical data model

Each project part is a **functional part** with a stable `id`,
`partNumber`, `name`, quantity, placement, purpose, required specifications
and acceptance criteria. Its `selection` contains zero or more physical
implementation candidates and at most one `selectedId`.

Implementation data includes manufacturing type (purchased, custom made in-house
or custom purchased), manufacturer, MPN, supplier offers, historical prices,
Workshop reference, detailed specifications, photos, CAD and drawings. None
of those properties should be redundantly persisted on the functional parent.

Core implementation: `functions/api/functional-part-model.js`.
Persistence boundary: `functions/api/components.js`, using
`resolveFunctionalPart` for existing consumers and `encodeFunctionalPart`
for canonical storage (schema version 2).

## Project purpose versus physical part presentation

Do **not** require a global Functional Type taxonomy. A project's description
of a component's purpose is intentionally freeform. A part's
`projectDetails.featureTreeName` is the optional, project-owned feature-tree
description; it must not be inferred from Workshop product categories, linked
Workshop captions, a manufacturer part number, or overwritten on Workshop reload.
Up to 180 characters are stored; keep display compact without truncating saved
text.

User-visible hierarchy for active parts:

1. Project part number + feature-tree description, or existing part name when
   no project description has been entered.
2. Actual selected physical implementation name (or manufacturer part number
   when a descriptive name is unavailable); show `No component selected` if
   the implementation is unresolved.

This behavior must be identical for purchased parts and custom designs.
Changing the selected implementation never rewrites the project-owned
description or number. The chosen physical implementation remains in the
Workshop/design layer; the engineering BOM resolves it without double-counting.

Keep existing layout, status controls, feature-tree drag/drop, Work Instructions,
Workshop links, and archive functionality. The project purpose field should be
easy to find in New Part / Edit Part, not hidden behind advanced specifications.

## Part numbers

- Project part numbers identify **functional requirements**, never particular
  manufacturer or design variants.
- Project numbering prefixes remain configurable; assembly sequences 1–99 and
  parts starting at 100 retain their established allocation rules.
- User-visible labels combine number and name only for display; the database
  stores them separately.
- The selected implementation has its own manufacturer part number or drawing
  and revision, not a second conflicting project part number.
- Example: `NR104 · LED Switch` selects `2N7000`; switching to a custom
  LED-driver PCB does not change `NR104`.

## BOM and engineering records

The engineering BOM includes functional requirements. The physical purchasing
plan resolves only selected purchased implementations; custom implementations
belong to fabrication, and unselected requirements remain clearly unresolved.
Never count the functional parent and its selected implementation as two items.

Implementation-specific CAD, drawings, saved supplier pages and other files are
scoped to the selected physical implementation. Functional Work Instructions
and investigation records can retain historical implementation provenance.

The visual feature-tree controls and selection behavior remain the same.
Styling is centralized through Studio Green theme tokens.

## Verification before treating this as production-stable

- Automated model tests: part identity survives changing implementation,
  supplier details are isolated, unselected parts do not appear in purchasing,
  retired alternatives retain history, and generated materials are not
  converted to functional parents.
- API regression: create an automatically numbered part, switch purchased →
  custom → purchased, and verify number, requirement and physical details.
- Frontend regression: check functional number/name display in feature tree,
  part headings and BOM; ensure an existing MPN does not override the functional
  label.
- Browser and live Cloudflare/R2 testing should still be performed.
- GitHub Actions failures must be diagnosed rather than ignored.

## Known tradeoffs

- Existing project data may be incompatible with the new schema. This is
  acceptable under the user's explicit instruction.
- Legacy records are read through a compatibility resolver; preserving every
  obsolete field is not a design goal.
- Requirement-level instructions stay separate from implementation-specific
  engineering assets. Future variants may need a more explicit test applicability
  and approval mechanism.
- Project backups and one-click live R2 restoration remain separate work.
