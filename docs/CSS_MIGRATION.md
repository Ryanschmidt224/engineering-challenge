# CSS migration status

The owner's screenshots define the intended standard, rather than exact preservation of legacy pixels. Use shared text sizes, controls, chevrons and spacing. Project data and storage contracts stay unchanged.

## This batch

- A curated dead-rule pass removes 359 selectors and 49,202 bytes. Its first isolated commit passed all 226 Node and 48 browser tests. The parser preserves active branches of mixed selectors and leaves ambiguous pseudo-selector cases alone. `node scripts/prune-retired-css.mjs` is a non-writing, repeatable check; `--write` applies only the reviewed list.
- One header renderer and one header style serve Projects, Workshop, Knowledge and calculators, with matching branding, navigation order, current-page treatment and Account access.
- The Projects toolbar uses shared control height, typography, padding and menu layout. Superseded header/toolbar rules are removed from legacy files rather than overridden.
- Hover tooltips wait 650 ms, cancel on exit, pointer-down, scroll or Escape, and remain immediately available to keyboard users. Tree dragging help is on an explicit help control, rather than the whole row.
- Completion indicators precede the feature-tree item text. They remain indicators, not checkboxes.
- Empty workspace sections use the same body spacing. Empty wrapper elements add no padding, creation still opens the editor, and error feedback remains visible. The redundant “No notes yet” line is removed.
- Project summary content sections start collapsed and use the shared disclosure header/body. Existing photo, summary, cost, BOM, tools, milestones, notes and clarification content and save handlers remain mounted.

## Follow-up batches

1. Part details: the Container name and Purpose fields should use the common field layout; Workshop information and Project-specific information should be matching tiles. Preserve the separation between Workshop source data and project edits.
2. One accessible, persistent column-resizer behavior for Workshop and Knowledge. Phone layouts should stack rather than expose unusable narrow panes.
3. Continue migrating remaining dialogs, lists, Work instruction content and photo markup. Delete the corresponding legacy rules in each batch. Consolidate breakpoints as their layouts migrate.

Do not automatically delete all classes absent from a text search. Dynamic classes, historical content, keyboard/focus states and error paths need review. Keep migration-specific checks alongside the existing browser workflows and screenshot evidence. Freeze limits may decrease; they must not increase to accommodate a new patch.

## Rollback

Revert the code batch and deploy its HTML, scripts and styles together. There is no data migration to reverse. Default collapsed states affect presentation only, never saved project content.

## Review scope and transition exceptions

The owner confirmed that this batch must remain unmerged for Claude review. The new engineering rules are recorded as proposed standards; this confirmation adopts the review gate, not every proposed automated check.

This is an incremental CSS ownership migration, not a completed ES-module rebuild of the main page. The existing site-assembly.js, project-manager.js and dialog-system.js grow slightly to preserve mounted handlers, use the shared header/account bridge and fix tooltip interaction. This is an explicit transition exception to the proposed “legacy JS never grows” rule. New header code is a small ES module with explicit initialization and no added window global. Help text is not yet fully centralized. The feature inventory is not falsely marked Rebuilt.

No new dependency, schema migration, API change, feature removal or application-data deletion is included. Proposed drops in the inventory remain undecided.
