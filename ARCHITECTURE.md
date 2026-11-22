# BuildingSchmidt architecture

BuildingSchmidt is a private engineering application for one owner, hosted on the existing Cloudflare Worker/static-assets deployment. The approved Workshop model replaces the earlier template/community/inventory systems. The owner has approved implementation and production deployment; see `STATUS.md` for actual release status and `docs/WORKSHOP_RELEASE.md` for acceptance and rollback.

## Storage and responsibilities

| Area | Source | Storage |
| --- | --- | --- |
| Workshop categories, families, stable typed fields, products, project uses | `functions/api/workshop-db.js`, `workshop-schema.js` | D1 binding `WORKSHOP_DB` |
| Workshop file metadata | `workshop_attachments`, exactly one family/product/use owner | D1 |
| Workshop file bytes | `functions/api/family-workshop-files.js` | Immutable R2 keys under `workshop-v2/files/` |
| Project catalog, assembly tree, project-only parts, instructions, evidence/history and project files | Existing project handlers | R2 binding `PHOTOS` |
| Workshop project part display | `assets/family-model.js`, project API projections | Resolved from D1, never copied into the R2 components collection |
| Workshop UI | `workshop.html`, `assets/family-workshop.js`, `workshop-ui.js` | Same Cloudflare site |
| Styling | `theme.css`, `components.css`, `family-workshop.css` | New Workshop loads these without legacy project overrides |
| Knowledge | `knowledge-seed.js`, existing project/site controllers | Existing source/R2 responsibilities |

## Data contracts

1. IDs remain stable when labels/order change. Product values and project requirements share family field definitions, but remain separately stored. Product display updates are live and never rewrite instructions or history.
2. Zero/false are distinct from missing values. Hidden fields retain data. A populated field cannot silently change its unit/type or lose a selected choice. Different product/requirement values prompt review; the app does not certify engineering compatibility.
3. Revisions protect editing across tabs. Family header/field writes use a single transaction and mutation token, preventing a stale header from leaking dependent changes. Products/uses additionally guard the family revision used to render the draft.
4. Foreign keys prevent cross-family product selection and orphan catalog references. Project references/assembly parents are checked against existing projects. Project use IDs are UUIDs compatible with the project file/instruction handlers.
5. Tree links are projected from D1 use membership and placement. Tool uses are excluded from the BOM. Nested assembly multipliers and family/product/requirements/unit grouping preserve each underlying use.
6. Files are uploaded to immutable R2 keys before metadata is inserted. Failed metadata writes can leave recoverable orphan bytes included in exports. Archiving never purges bytes.
7. The initial D1 schema starts clean with editable starter definitions only. Existing R2 Workshop data is neither imported nor deleted. Any future persistent schema change needs its own versioned, tested upgrade procedure.

## Access

`worker.js` calls `private-access.js` before dispatching application APIs. The temporary boundary requires the existing administrator session for reads/writes and validates mutation origins. Public registration is closed. Paid AI endpoints stay paused until they share a tested spending limit. Unknown APIs return structured 404; retired Workshop APIs return 410 after authorization.

This is API privacy, not a claim that Cloudflare Access is configured over every static asset/hostname. Retain the existing working owner login until replacement identity and all serving hostnames are verified. Never trust an unverified identity header or weaken the boundary to repair a deployment.

## Recovery and validation

`npm run check` performs syntax, CSS guardrails and Node tests, including real SQLite transactions/constraints and Worker integration. `npm run test:browser` runs project workflows plus actual-handler family/product/use tests against a disposable server. Test server/accounts are excluded from deployed assets and are not imported by the Worker.

Workshop exports contain catalog/use metadata and Workshop bytes with per-file hashes and a complete trailer. `scripts/workshop-backup.mjs` verifies a downloaded export and tests catalog restoration into an empty isolated database. Separate project exports remain necessary for project instructions/history/files. Existing scheduled R2 project snapshots are not a complete independent D1 backup.

No live purge is part of this release. Old mutation handlers and UI source are removed in Git; retained read-only legacy project backup dependencies do not reopen Workshop writes. Old R2 bytes can be retired only after an enumerated independent backup and verified restore. Code rollback preserves both the D1 resource and all R2 bytes.

## Deferred work

Cloudflare Access/identity replacement; full independent automated backups across D1/R2; product family moves with explicit mapping; structured pin-list editing; a safe cross-storage assembly archive for active D1 uses; broad project controller/CSS consolidation. These are separate batches, not hidden compatibility systems in the new Workshop.
