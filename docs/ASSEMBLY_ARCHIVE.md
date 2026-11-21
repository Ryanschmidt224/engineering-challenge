# Nested Part and Subassembly Archive

## Goal

An administrator can right-click any part or subassembly in the feature tree and
choose **Archive**. That occurrence leaves the active tree and BOM, while a
read-only snapshot remains associated with the immediate parent assembly.
Archiving an assembly includes all nested nodes and their associated project
records. The same archive can later be restored.

This is not **Save part revision**, which snapshots the previous specification
of a part that remains active.

## Storage

Each snapshot uses a generated archive ID:

- `assembly-archives/<project>/manifests/<archive-id>.json` — indexed, versioned
  manifest, original parent ID, subtree nodes, component definitions, relevant
  investigation records, external dependency links, timestamps and file map.
- `assembly-archives/<project>/<archive-id>/objects/<encoded-original-key>` —
  immutable copies of related workspace JSON, photos, drawings, part files,
  saved product pages, code, notes, thumbnails and photo markup.

The manifest and objects are included in the project-export allowlist.
Existing original files are intentionally not removed on archive.

A part definition is removed from the active components list **only** if it is
no longer referenced by any active tree occurrence. Derived materials belonging
to a removed source part are also captured and removed from the active BOM.

## Mutation and recovery

Archiving:

1. Read current tree, components and investigation records.
2. Select the entire subtree, ensure referenced component definitions exist.
3. Copy related records and assets to immutable archive object keys.
4. Write a prepared archive manifest.
5. Remove the subtree from the active tree using conditional storage writes.
6. Remove now-unused component definitions, with rollback of the tree on a
   component-write conflict.
7. Mark the manifest archived.

Restoring:

1. Check the original parent and all IDs/part numbers for conflicts.
2. Verify and repopulate missing copied files before making the nodes active.
3. Restore part definitions and tree occurrences with conditional writes.
4. Reattach saved external dependencies and missing investigation records.
5. Mark the archive restored, retaining it as historical evidence.

The feature tree and components are separate R2 objects, **not a database
transaction**. A failed or interrupted multi-object write can leave a recovery
state. A prepared manifest is retained for recovery, rather than deleting the
only copy of an item. Idempotent restore finalization handles a restore whose
tree write completed before the last manifest update.

Never treat a partially completed action or a successful Git commit as
confirmation that live Cloudflare storage was verified.

## Important behavior

- Archiving a shared part occurrence never changes another occurrence's BOM
  reference.
- Restoration rejects an archived shared part whose live definition was changed.
  It must not overwrite another active use.
- Part/assembly number collisions block restoration rather than reassigning
  identifiers silently.
- The archive viewer is read-only, with saved photos and downloadable files. Access is limited to project editors because archives can contain restricted CAD and part files.
- Previously archived children remain reachable from an archived parent.
- Older project data is not silently rewritten or destroyed by deploying
  this feature. Data is archived only when an authorized user selects Archive.

## Testing and rollback

- `npm run check` includes syntax checking of the archive API.
- `npm test` includes subtree traversal, shared-use selection, history
  selection, archive asset preservation and photo markup tests.
- Archive and restore paths have also been exercised against a mocked R2 store,
  including shared and unique parts and generated materials.
- **Code rollback**: branch `rollback-before-assembly-archive-2026-11-20`
  points to the last version before this feature.
- **Project data rollback**: use the saved manifest/Restore operation. A code
  rollback alone does not reverse user actions that archived live project data.

### Known limitations / future hardening

- R2 cannot atomically commit the feature tree, component list and archive
  manifest as one transaction. For high-concurrency usage, add an explicit
  durable mutation journal and reconciliation endpoint.
- The general project export currently has size/object-count ceilings; large
  photo-heavy archives can exceed them. Archive copies also require storage.
- Test the complete workflow in the deployed UI, including partial failures,
  multiple sessions and very large archives. In-source mocks are not proof of
  successful production deployment.
