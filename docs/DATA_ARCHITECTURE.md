# Building Schmidt — data architecture contract (draft v1)

Status: approved direction; **no destructive migration is authorized by this document**.

## Project identity and ownership

- A project has a stable identifier that is not its display name. Current site project IDs (`launcher`, `linear`, `robot`, `buck`, `motorlab`, `coiltest`) are legacy identifiers and remain valid.
- Each entity has an immutable ID. Renaming, moving, sorting, or editing an entity must not change that ID.
- An engineering **part definition** is distinct from its **occurrence in an assembly**. The definition contains intrinsic specs; an occurrence refers to that part and stores quantity, location, and assembly-specific overrides. Existing records may conflate these; preserve them unchanged until an explicit, tested migration is provided.
- Recipes have stable step IDs independent of the order of display. Referenced drawings/knowledge must bind to IDs rather than step numbers.
- Knowledge has a scope: public, project-private, or organization-private. A private project is never implicitly publishable.

## Ownership and isolation

- All engineering data must be exportable and readable independently of Cloudflare.
- Private/local projects must require no connection to Building Schmidt servers. **This is an architecture requirement, not yet an implemented offline mode.**
- Publishing is an explicit operation that selects the subset to be shared. A visibility flag alone does not make Cloudflare storage private.
- Store no secrets in public static assets, public project exports, or source control. Exports may contain proprietary designs and must be treated as sensitive files.

## Logical schema, v1

```text
Project
 ├─ Assembly (id, parentId, dependencies)
 ├─ PartDefinition (id, specifications, sharedLibraryRef?)
 ├─ BOMOccurrence (id, assemblyId, partDefinitionId, quantity, overrides)
 ├─ Recipe (ownerType, ownerId, steps[])
 │   └─ Step (id, order by array position, title, standard, detail, kind)
 ├─ Asset (id, mediaType, name, sha256, bytes)
 ├─ KnowledgeReference (id, scope, source owner/step and exact text range)
 └─ Revision (savedAt, editor, data version, immutable snapshot reference)
```

This is a **target logical schema**, not a claim that current records already follow it.

## Portable archive format

- File extension `.bsproject`, UTF-8 JSON in v1. Root has `format`, `schemaVersion`, `projectId`, `exportedAt`, and `objects`.
- Each object contains the original storage key, media type, HTTP metadata, optional custom metadata, content length, SHA-256, and base64-encoded bytes. R2 keys must be inside the project's allowlisted namespaces, or the specifically declared shared-library dependencies.
- The archive is lossless for **every supported project storage record**. It must fail loudly on missing, malformed, truncated, unsupported, or oversized data; never silently omit items.
- Shared libraries are currently global. An export may include the entire shared wire and common-part libraries, which can contain references unrelated to the selected project. Treat exports as confidential until this is normalized.
- Exported data is never automatically published, committed to GitHub, or transmitted to third-party services.
- Import must first validate manifest, supported schema versions, scope, integrity hashes, all references, size, and destination ownership **without changing live data**. Restoring into live data must create a recoverable snapshot and provide a dry-run summary. Multi-object Cloudflare writes are not atomic; a complete rollback strategy is required before enabling production restore.

## Versions and migrations

- `schemaVersion=1` defines the archival envelope. Existing internal JSON formats stay unchanged until separate migration versions are specified.
- Future versions need pure `migrate(vN→vN+1)` functions, fixtures, automated round-trip tests, and an explicit rollback plan.
- Never rewrite a live record in place merely because it was read with a newer app version; no implicit migrations.
- A missing or newer unknown schema must produce an actionable error, not best-effort data loss.

## Backups and recovery

- Git commits protect **source code**, not the R2 project records.
- Keep an off-Cloudflare copy of each downloaded `.bsproject` archive. Test decoding, checksums, and completeness before relying on it as a backup.
- A Git checkout/revert only changes application code; it does not restore project data saved in Cloudflare.
- Current legacy workspace revision history is limited and other records are not a consistent point-in-time snapshot. True coordinated snapshots and concurrency controls are future work; do not claim project-wide rollback exists.
- Never delete past Git commits or R2 originals as part of migration. Destructive restoration needs explicit operator action and a separate confirmed backup.
- Project archives are not guaranteed transactionally consistent if anyone edits data while export is in progress. Export during a maintenance window until optimistic concurrency or snapshot generation is implemented.

## Storage independence

- Engineering validation and transformations should live in pure modules with no DOM, R2, or HTTP dependencies.
- Storage access belongs behind an adapter boundary. The archive service reads R2 through a read-only enumerator; future local/SQLite storage can implement the same boundary.
- UI and persistence should treat IDs and versions as opaque, not derive them from file paths, names, or positional step numbers.

## Remaining implementation gates

1. Test project archive end-to-end against a representative export containing BOM, instructions, drawings, thumbnails, photos, harnesses, and nested assemblies.
2. Add **read-only import inspection** and a fixture-based archive round-trip test.
3. Add durable, immutable, transaction-aware live restore/rollback before exposing any overwrite-capable import.
4. Implement schema transformations for part definitions versus occurrences only after fixture-based reversible migrations pass.
5. Add local/desktop adapter and privately hosted mode; do not assume either is already available.

## Implementation status (2026-11-08)

- Implemented: read-only server export, exact R2 prefix enumeration with pagination, per-object hashes, full-archive length checks, a browser-only archive checker, and explicit failure if a record disappears or an export limit is reached.
- Implemented: non-destructive, administrator-only server inspection endpoint (for API consumers). The **website's backup checker runs locally** and does not send the archive back to the server.
- Implemented: workspace revisions and optional optimistic concurrency tokens for assembly and part instructions, with a 409 response on stale saves.
- Code recovery: the `safety/pre-data-architecture-2026-11-08` Git branch preserves the implementation before this work. It does **not** contain private Cloudflare data.
- Not implemented: overwrite-capable archive import, coordinated transactional project snapshots, automatic offsite backups, migration of legacy part/BOM records into separate tables, offline desktop use.
- Current archive exporter has explicit memory/size limits. Larger projects will require a streaming archive implementation; the exporter refuses oversized projects rather than returning a partial backup.
- Archival exports are taken while storage is live and are **not point-in-time consistent** if other changes occur during export. Avoid editing a project while exporting.
