# Legacy-style project summary on the current engine

The project summary restores a single full-width stack: Project photos, Project summary (40-character short summary, long summary and tags), Estimated project cost, Project Intent & Milestones, Project BOM, Tools needed and Unstructured Notes. Tools uses the same section width and styling. Shared photo controls, gallery layout, file uploads, dialogs and navigation remain in use. The existing folded top assembly's details, work instructions, CAD files and revision/history remain available below these sections.

Original intent is editable under the owner's updated instruction: every edit requires a reason, and every saved version retains its ID, timestamp, content and reason. Initial intent and subsequent versions remain available; milestones are explicitly added and never generated automatically. Notes support editing, removal and the shared attachment uploader with drag/drop and image paste. Removing a note keeps uploaded files in project storage/backups.

Costs distinguish individual quantities from full packages, multiply active parent quantities, exclude tools/assembly definitions/documents, report missing prices and preserve zero. USD only: no exchange-rate guesses. Explicit historical USD individual/package specifications can supply a starting estimate; per-project price overrides do not change Workshop data. Ambiguous or non-USD specifications remain unpriced.

Engine migration 13 adds one JSON overview column to the project header. All writes use the existing project revision and idempotent command admission. Original intent history is appended server-side; clients cannot overwrite earlier versions. Data is validated/capped at 200 KB, 250 notes/milestones/intent versions, 20 tags and 12 attachments per note. Note attachments must be ready files owned by this project.

Small and streamed exports preserve the header. Restore validates content, intent version consistency and note attachment availability. Older backups default to an empty overview; existing header bytes remain unchanged on restore. Readable HTML includes summary, all intent versions, milestones, notes and prices. The current project data and legacy source projects are not imported or overwritten automatically.

Rollback limitation: the existing schema guard rejects older schema-12 writers after migration 13. Roll forward with a compatible fix; do not redeploy older code as a data rollback. Permanent deletion PR #110 is held separately and needs its migration renumbered to 14 after this release; no deletion is included here.

Validation covers revision conflicts, required edit reasons, append-only intent versions, exact backup/restore and older-backup compatibility, cost arithmetic, project-level notes, responsive stacked layout, retained assembly instructions/CAD/history and current readable export behavior. No production project content is edited by these tests.
