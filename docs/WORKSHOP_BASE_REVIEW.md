# Workshop base form review

This batch is a working design preview at `workshop-preview.html`, stacked on the private API containment branch. It does not replace the current Workshop, call any application API, upload files, or persist data. Drafts and templates remain in the tab until reload. Production hosting and storage are untouched.

## What to review

- Try the MOSFET, supply, generic resistor, custom bracket and soldering iron examples. These are illustrative fixtures, not verified engineering specifications.
- Create an item with only a name. Category is inherited from the selected example and can be changed without reapplying a template.
- Identity has one name and one manufacturer part number. An optional different model designation and tool behavior are tucked into additional options. Project container names and purposes are absent from the Workshop form.
- Technical fields use one definition list. Each definition has a stable ID, label, type, optional unit/options and Workshop/project destination. The same value-row renderer serves item editing, read view and project-use preview; the template builder edits these definitions without values.
- Ordering, links, notes and stock are optional. Read view omits empty sections and preserves numeric zero and Yes/No values. Ordering derives unit price from package price and quantity. Multiple documents share the same reference collection.
- On the generic resistor, enter resistance in Project use, then return to the Workshop. The reusable power rating stays unchanged. Project input values are never included in a template.
- Open Template builder from the main form. Rename, reorder, add or remove fields, then preview the changes before applying. Unmatched stored fields remain in Additional saved details and can be restored. Changing the type, unit, selected choice or destination of a populated field is rejected without converting or losing the draft.
- Verify phone-width layout, visible labels and keyboard controls. Template actions do not depend on a right-click menu.

## Data contract

`assets/workshop-base-model.js` is a new version-one contract, with no legacy importer, alias map, live template inheritance or storage adapter. Standard Identity/Specifications/Ordering/Files/Notes sections are defined by code. Category templates configure technical definitions rather than duplicating every standard field.

An item contains identity, field definitions, Workshop values keyed by field ID, supplier references, attachment/link references and notes. Project-use values and stock are separate preview records. A template snapshot explicitly selects field-definition properties and excludes item values, identities, photos, prices, stock and project data. The preview keeps only one draft template; it is not a saved category-template library.

The owner identified current data as disposable placeholders, so the later production model can start empty. This batch intentionally does not translate the old `spec`, `genericFields`, Product Builder fields or custom layout rows. It leaves existing writers and records untouched.

## Validation and limits

Node tests exercise all five examples, name-only validation, zero/false, project ownership, template value stripping, stable rename/reorder, preservation/restoration, incompatible changes, duplicate fields, derived prices and unsafe URLs. Browser tests exercise the form's actions, template preview/conflict handling, multiple documents, project values, mobile overflow and keyboard controls, alongside the existing application suite.

The preview does not implement D1, real file upload, durable autosave, multi-stock-entry management, inventory reservations, AI lookup, persisted template revisions or project-part creation. Those behaviors must not be inferred from this UI. The existing production template API's revision checks remain covered separately by the foundation tests.

## Next integration gate

Review this base form before expanding category-specific templates. Then wire the agreed contract to a clean D1 domain and immutable R2 file references in another branch. Add staged Cloudflare tests for owner identity, revision conflicts, save failure/retry, attachment association and file recovery before replacing the current Workshop.

## Rollback

Revert this preview commit or close its PR. The existing page, API dispatcher and storage bindings are unchanged. No data restoration or conversion is needed. Keep the earlier access-containment branch separate and do not roll it back to remove this preview.
