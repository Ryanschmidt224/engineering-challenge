# Project Intent & Milestones

This is an optional, deliberately curated project narrative in Project Summary.
It is independent of Project History, ordinary part edits, Work Instructions, and archived items.

## Records

- Original intent: one server-timestamped, append-only record with objective, success criteria, and initial plan. At least one field is required. Later changes become new milestones rather than overwriting this first record.
- Milestones: ordered, server-timestamped entries requiring both 'What happened?' and 'Why is this significant to the project?'
- A milestone can optionally reference a verified Test/Measurement, Revision, Failure, or archived part/subassembly. The source title and location are snapshotted, not used to rewrite the milestone.
- If intent is recorded after earlier milestones, it is visibly labeled as first recorded intent rather than implicitly preregistered.

## Storage, security and limits

Records live in R2 at `project-milestones/<project>.json` and are included in project exports.
The backend `functions/api/project-milestones.js` allows GET and append-only POST operations; there is no edit or delete API.
Project owner access, same-origin checks, revision tokens and conditional R2 writes protect additions.
Up to 250 milestones can be appended; fields have explicit maximum lengths.
Application immutability does not make records physically immutable to operators with direct access to R2.

## Entry points

- Record original intent or a milestone on the Project Summary page.
- After a successful feature-tree archive, the optional Add to Project Milestones button opens a draft; it never writes automatically.
- Tests/Measurements, Revisions and Failures offer the same optional draft action.
- A source draft can prefill the event description and contains the verified source reference, but the author must deliberately explain significance and save it.
- No routine part updates, page views, test writes, or history entries are automatically copied.
- Read-only viewers do not see the section on projects that have never used it.

## Implementation

- UI: `assets/project-milestones.js`
- Placement and archive action: `assets/site-assembly.js`
- Investigation entry action: `assets/investigations.js`
- Worker route: `worker.js`
- Export key allowlist: `assets/archive-layout.js`
- Tests: `tests/project-milestones.test.mjs`
