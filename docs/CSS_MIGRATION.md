# CSS migration status

The owner's screenshots define the intended standard, rather than exact preservation of legacy pixels. Use shared text sizes, controls, chevrons and spacing. Project data and storage contracts stay unchanged.

## This batch

- A curated dead-rule pass removes 359 selectors and 49,202 bytes. Its first isolated commit passed all 226 Node and 48 browser tests. The parser preserves active branches of mixed selectors and leaves ambiguous pseudo-selector cases alone. `node scripts/prune-retired-css.mjs` reports without writing; `--check` fails if reviewed retired selectors remain, and is included in `npm run check`. `--write` applies only the reviewed list.
- One header renderer and one header style serve Projects, Workshop, Knowledge and calculators, with matching branding, navigation order, current-page treatment and Account access.
- The Projects toolbar uses shared control height, typography, padding and menu layout. Superseded header/toolbar rules are removed from legacy files rather than overridden.
- Hover tooltips wait 650 ms, cancel on exit, pointer-down, scroll or Escape, and remain immediately available to keyboard users. Tree dragging help is on an explicit help control, rather than the whole row.
- Completion indicators precede the feature-tree item text. They remain indicators, not checkboxes.
- Empty workspace sections use the same body spacing. Empty wrapper elements add no padding, creation still opens the editor, and error feedback remains visible. The redundant “No notes yet” line is removed.
- Project summary content sections start collapsed and use the shared disclosure header/body. Existing photo, summary, cost, BOM, tools, milestones, notes and clarification content and save handlers remain mounted.

## Follow-up batches

1. Completed in the Part information batch: matching reference/project information tiles and shared Container/Purpose field rows. Existing project-owned edits stay separate from Workshop.
2. One accessible, persistent column-resizer behavior for Workshop and Knowledge. Phone layouts should stack rather than expose unusable narrow panes.
3. Continue migrating remaining dialogs, lists, Work instruction content and photo markup. Delete the corresponding legacy rules in each batch. Consolidate breakpoints as their layouts migrate.

Do not automatically delete all classes absent from a text search. Dynamic classes, historical content, keyboard/focus states and error paths need review. Keep migration-specific checks alongside the existing browser workflows and screenshot evidence. Freeze limits may decrease; they must not increase to accommodate a new patch.

## Rollback

Revert the code batch and deploy its HTML, scripts and styles together. There is no data migration to reverse. Default collapsed states affect presentation only, never saved project content.

## Review scope and transition exceptions

The owner originally held the foundation batch for Claude review. Claude approved it with no blocking findings, and the owner subsequently authorized implementation and production deployment of the evaluated inventory cleanup. Remaining unimplemented engineering checks stay proposals; there is no outstanding deployment hold on these authorized batches.

This is an incremental CSS ownership migration, not a completed ES-module rebuild of the main page. The existing site-assembly.js, project-manager.js and dialog-system.js grow slightly to preserve mounted handlers, use the shared header/account bridge and fix tooltip interaction. This is an explicit transition exception to the proposed “legacy JS never grows” rule. New header code is a small ES module with explicit initialization and no added window global. Help text is not yet fully centralized. The feature inventory is not falsely marked Rebuilt.

No new dependency, schema migration, API change, feature removal or application-data deletion is included. Proposed drops in the inventory remain undecided.

## Claude review corrections

The uploaded PR45 review approved the batch with no blocking issues. Follow-up changes give summary, assembly and part section lists one shared 12 px gap, retire their conflicting legacy container layout rules, and keep the requested collapsed defaults. Empty legacy save wrappers are removed while status messages and save handlers remain mounted. The phone header keeps navigation on one row, scrolling horizontally only when necessary, and the Projects brand returns home without a document reload.

Tree status marks and menu panels now use generic UI component classes; project tag filter and editor chips adopt the shared chip component. Keep `button--quiet`: Workshop and Knowledge actively use it. Only the unused small/danger aliases are removed. The contradictory empty-state wording is corrected. The obsolete one-shot pruner is removed, and the curated retirement check now runs in `npm run check` and fails on reintroduced retired CSS or source references. A CLI regression test verifies non-writing checks, mixed-selector preservation and reintroduction detection.

A blanket unused-class failure remains deferred because text search cannot establish absence of dynamic and stored-content classes. Retain reviewed retirement lists and the CSS guardrails. The Workshop/project information tiles and adjustable columns remain separate follow-up batches.


The next CSS batch replaces duplicated built-in project markup with one inert HTML template and uses the same catalog/card rendering for built-ins and new projects. Existing project IDs and stored records remain unchanged. Project scopes use a shared project-view class instead of launcher/linear/robot ID selectors; this lowers specificity at the original rule rather than adding overrides. A strict static class-producer check follows loaded scripts and module imports, ignores comments and selector-only lookups, and requires an explicit documented pattern for code-built class names. It fails on unmatched selectors, with a reviewed retirement list supplying removals. Boolean selector pseudos retain live alternatives and simplify retired branches; unit and browser tests cover these transformations. Literal matches are conservative static evidence, not a runtime reachability proof inside every function.

The Part information batch moves the detail renderer into an ES module and replaces its old table/container/view classes with shared information panels and field rows. The 24 replaced class names are curated retirements; their old CSS branches are deleted in the same batch. Editor-only rules remain. Product facts and project requirements are distinct derived API fields, not another stored copy. Rollback reverts this code batch and deploys scripts/styles together; there is no database migration or project data to reverse.
