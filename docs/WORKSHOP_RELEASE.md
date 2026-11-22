# Family Workshop release and recovery

## Scope

The approved model is category → family → optional product → project use. Family fields have stable IDs, typed values and optional display hints. Product values take precedence in the current display; project requirements remain separate and differences are flagged for human review. Zero and false are values. A hidden field retains its saved values. Renaming/reordering fields retains IDs; changing the units/type of a populated field is refused.

`WORKSHOP_DB` owns catalog records, uses, revisions and attachment metadata. `PHOTOS` R2 owns immutable Workshop bytes under `workshop-v2/files/`. Existing project trees, instructions, evidence and history remain in their current R2 namespaces. Tree links are a projection of the D1 uses, including archive/restore and parent assembly changes. Uses are never copied into the R2 components collection.

The initial catalog contains 33 categories, 60 families and 233 field definitions. No product ratings, inventory or project uses are seeded. Bootstrap runs once. Existing Workshop records are not imported and are not deleted by this release.

The retired template, Product Builder, personal/shared Workshop and inventory frontends and mutation handlers are removed. Their former HTTP routes return 410 behind the owner boundary. Existing project-only parts and read-only legacy project backup dependencies remain available. Git history preserves the retired source.

## Acceptance checks

- Node tests execute the real SQLite schema, JSON functions, composite foreign keys and transactions. They cover stale revisions, atomic family edits, unit/type protection, seeded definitions, generic uses and product changes that preserve requirements.
- Worker integration tests cover private attachments, safe downloads, attachment archiving, missing bytes, streaming export checksums, multi-chunk files and isolated catalog restore. Damaged/truncated exports are rejected.
- Project tests verify that product selection and edits do not rewrite instructions or historical evidence; project-use statuses/quantities obey revisions; use archive/restore does not leave stale tree links; nested BOM multipliers and grouping retain identities.
- Real-handler browser tests cover family/product creation, generic project uses, returning to a project, two-tab conflicts, hidden/stable fields, duplicate family, multiple files/export, archive/restore, failed-save retry and a 390px viewport. Existing project workflows remain in CI.
- Cloudflare binding/provisioning and live authentication must be checked separately. Passing a SQLite fixture is not proof of a deployed D1 binding. Disposable test-server endpoints are not imported or served by the production Worker.

## Intentional limits

- Paid AI lookup remains paused until a shared spending limit is implemented. Manual entry is available. No provider call is enabled by this release.
- Moving an existing product/use to another family is refused. Mapping populated fields and related project requirements needs its own reviewed change; do not silently discard unmatched values.
- Pinout images/documents can be attached; a separate pin-list editor is deferred.
- The existing R2 assembly archive refuses an assembly containing active D1 uses. Move or reversibly archive those uses in Workshop first. This avoids partial cross-storage archives. Project instructions/files remain retained.
- The temporary owner-session API boundary remains. Cloudflare Access over all serving hostnames and static assets has not been configured by this code.
- Broad project CSS consolidation is deferred. The new Workshop loads theme tokens, shared components and its layout stylesheet. Legacy override files are frozen; CI rejects increases in `!important` or project-ID specificity. Raw CSS line counts are not correctness criteria. Controls use minimum heights and wrapping instead of fixed small boxes.

## Backups

Download **Export Workshop** and run:

```sh
node scripts/workshop-backup.mjs BuildingSchmidt-Workshop.ndjson
```

The verifier reads the export incrementally, verifies every file's size/SHA-256 and complete trailer, checks catalog constraints/values, and restores the catalog into an isolated in-memory SQLite database. It never writes to production. The tested `restoreCatalog` helper refuses a nonempty destination. File chunks may be restored into a separate staging bucket only after the whole export verifies; compare the destination hashes before any promotion.

Workshop exports contain the complete D1 catalog/uses/attachment metadata and all bytes in the Workshop file namespace, including archived references and recoverable orphan files. They do **not** contain project instructions, photos, evidence or account/configuration data in other R2 namespaces. Retain the separate project exports as well. Existing scheduled project backups do not yet constitute a full independent Workshop backup. Keep a downloaded verified copy outside Cloudflare before any destructive maintenance.

No live purge is included. Before retiring old R2 content, enumerate its exact namespaces/objects, take an independent byte-and-metadata backup, verify a restore and record what will be lost. Credentials, account records, recovery copies and new Workshop namespaces stay outside that purge.

## Deployment and rollback

1. Verify Node/browser CI at the exact proposed head. Record main source and the current healthy Cloudflare version. Existing security release: main `f47a4d5342a080c8765f8e3a984a94ce5115d007`, version `abbfd86f-6425-4c6c-ac73-376b759bc05c`.
2. The owner has authorized production deployment. Merge the reviewed family branch only after checks pass; the existing Cloudflare main-branch build performs deployment. Wrangler config requests a separate D1 resource named `building-schmidt-workshop`, binding `WORKSHOP_DB`. Confirm the actual build provisions or reuses that resource. Never point an isolated QA fixture at production.
3. Verify the production build/version and live Workshop. Confirm anonymous direct catalog/file/export requests are denied and owner login can load seeded families, save/reopen a product/use and download an export. Inspect unexpected errors before accepting the release.
4. If provisioning/build fails, leave the previous healthy release serving. Correct the binding/build configuration; do not remove the owner gate to get a successful response.
5. If live behavior regresses, stop edits and download/verify new Workshop and project exports before a data-affecting reversal. Roll back the Worker to the security release above (or a later known-good authenticated version). Retain the D1 database/binding and all R2 bytes. The previous UI will not display new D1 uses; that is a temporary visibility limitation, not restoration or deletion.
6. Restore corrected code against the same D1 binding and verify counts, requirements, instructions and files. Do not delete/reseed D1 as a code rollback procedure. Never roll back the registration closure or paid-AI pause.
