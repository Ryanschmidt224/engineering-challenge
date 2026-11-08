# Building Schmidt — Product design rules

## Primary rule

**Minimize decisions, clicks, choices, and tedious data entry. Standardize wherever possible.**

This rule takes precedence over copying a competitor's feature list. New functionality should make the *actual engineering work* easier, not increase administrative work.

## How new features should behave

1. **Prefer a standard automatically.** Example: the wire wizard starts with 22 AWG for signals and 18 AWG for low-voltage power when the provisional checks permit them. Don't make users choose from ten interchangeable options when two standards meet the need. Never silently treat a voltage-drop calculation as a verified safe ampacity rating.
2. **Ask only what is needed.** Part names, measurements, and optional supplier details should not all become required fields. Unknown solder consumption or future material quantities can remain blank.
3. **Enter a fact once.** Reusable part definitions live in the shared catalog, while assembly BOM items reference them. The feature tree organizes significant assemblies and parts; it is not required to contain every consumable.
4. **Calculate dependent materials.** If wire terminations require ferrules, the BOM derives them from the wire configuration. When the wire changes, the derived material changes. A generated item is not an independent, editable source of truth.
5. **Keep the default page short.** Use one main action per workflow and reveal advanced views only when asked. For example, assembly BOM is the default and a single "Shopping list" action gives the flattened purchasing view.
6. **Don't force an instructional format.** Freeform build instructions remain valid. Step previews, photos, linked explanations, optional experiments and revision history help when needed.
7. **Record revisions automatically.** No manual revision naming or approval process for ordinary hobby engineering notes. Keep meaningful test observations separate from established specifications.
8. **Protect existing work.** Preserve existing project IDs, saved BOM entries, photos, drawings and instructions. Add fields backwards-compatibly. Never silently delete or reclassify older manually entered parts in a migration.
9. **Make defaults explainable and overridable.** A wizard should explain the reason for a recommendation and allow an intentional exception. Prefer qualified language for safety-related engineering calculations.
10. **Reject administrative feature creep.** Warehouse location systems, mandatory purchase orders, approval workflows, certifications, full electrical CAD and elaborate analytics are not part of the default learner experience.

## Engineering model

- **Catalog definition:** shared manufacturer/part identity, technical specifications, and standard part keys.
- **BOM usage:** quantity and unit in a particular assembly; quantity may be unknown.
- **Feature tree:** only assemblies and major parts needed to understand and navigate the design.
- **Derived BOM usage:** generated from an authoritative source part, with a stable source relationship. Editing the source updates its generated materials.
- **Work instructions:** existing simple prose first; optional step preview, resources, drawings, experiment notes, and history.

## Release checklist

Before adding a visible field, button or question, ask:

- Can its value be inferred safely from a preferred standard or existing project data?
- Can it stay optional?
- Does it duplicate data already captured elsewhere?
- Can it be folded into an existing action or an on-demand advanced area?
- Will a later edit correctly update all dependent BOM items?
- Does the implementation preserve user data and explain any remaining engineering uncertainties?

If the answer is no, simplify the design before implementation.

## Standard shop materials

- The full technical BOM still contains consumables, but default Thumbnail and List views put commonly owned supplies in one collapsed **Standard shop materials** section.
- Assume generic ferrules, solder, heat shrink, and common 18/22 AWG raw copper wire are already available; do **not** claim actual inventory was measured.
- Crimped wire assemblies stay as real BOM parts. Automatically derived raw-wire cut length and ferrules are displayed as shop materials when they match preferred standards.
- Nonstandard gauges and manufacturer-specific materials are purchasing items by default.
- Provide exactly one override per material usage: **Treat as purchase item** or **Assume on hand**. This should not require editing the full BOM form.
- A source wire edit must update its derived supplies without losing their explicit purchase/stock preference.
- Do not silently rewrite legacy manually entered consumables. Recognize them by name when safe; leave reconciliation to deliberate edits.
