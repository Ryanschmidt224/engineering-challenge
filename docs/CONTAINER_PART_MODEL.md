# Container → Part → Revisions

## Product language

A **Container** is a stable item in the project hierarchy. It owns the project number, short name, purpose, related work instructions, tests, records, and history. A container may contain parts or child containers.

A **Part** is what is actually built or purchased for that container. Its part type is off-the-shelf, custom made in-house, or custom purchased. Manufacturer, MPN, supplier, and BOM purchasing details belong to the part, not to the container.

**Revisions** track iterations of the *same custom design*. For example, replacing a 3D-printed bracket with a stamped steel redesign is recorded in Revisions, not as a competing implementation.

**Alternative purchased parts** are optional choices of commercially available parts for the same container. The active purchased part appears in purchasing and BOM totals; alternative candidates must not add to BOM quantities.

A changed sourcing method or alternative must not rename or renumber the parent container.

## UI contract

- New Part and Edit Part use Container (name) and Part details.
- No general-purpose “Selected implementation” chooser, “Add implementation”, or “Retire implementation” controls.
- Custom parts use existing Revisions and testing/history features.
- Purchased parts have a collapsed **Alternative purchased parts** section.
- Workshop-linked project edits never change their original Workshop item.
- Label and input align horizontally; avoid overlapping searches, duplicate labels and unnecessary cards.

## Internal migration status (2026-11-21)

The user-facing flow follows this model. However, server persistence still uses `functions/api/functional-part-model.js` candidate records to select a purchased alternative and preserve existing implementation-scoped drawings, files, and saved product pages. Those legacy internals must not reappear as extra fields or force custom part design changes into new candidates.

This is not yet a v3 storage-schema migration. **No existing project or product records have been deleted or purged.** Before a destructive replacement of older candidate history or its files, identify the scope of potential loss and obtain explicit user permission. Prefer removing the internal candidate indirection once a tested part-and-alternatives schema and asset migration are available. Avoid building more compatibility UI solely to preserve the old structure.

## Verification still required

Run `npm run check`, browser tests for custom edits and purchased alternative selection, and a live deployment test with real Workshop and R2 records. GitHub commits alone are not evidence that the Cloudflare site was deployed.
