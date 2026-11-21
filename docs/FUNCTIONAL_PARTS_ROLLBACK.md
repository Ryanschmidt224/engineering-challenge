# Functional Parts Architecture — Rollback Gate

Checkpoint created November 20, 2026 (America/Phoenix).

## Code rollback (already secured)

- Repository: `Ryanschmidt224/engineering-challenge`
- Known-good commit: `b1d628794e8944dc7eef0e726f71f98db18f36ec`
- Frozen reference branch: `backup-before-functional-parts-2026-11-20`
- Isolated development branch: `feature/functional-parts`
- Production branch: `main`; do **not** merge experimental schema changes until checks below pass.

A branch snapshot protects source code only. Re-deploying this commit does **not**
restore R2 objects or reverse an incompatible data migration.

## Project data backup — must complete before migration

The existing website offers a downloadable `.bsproject` export in each
project workspace under **Project backups → Create project backup**.

For every project, including private projects:

1. Export and download the `.bsproject` file.
2. Save an independent copy outside Cloudflare R2 (e.g., local disk +
   independent cloud storage).
3. Validate it using the project's archive validation code (including
   object counts, SHA-256 hashes, and original project ID).
4. Record the backed-up projects, export times, object counts, checksums
   and any failures below.

The weekly `automatic-backups/` R2 snapshots are append-only but **not
offsite** and have not been verified for this checkpoint.

Current archive exports are limited to at most 1,500 objects / 72 MiB
(total uncompressed data) / 24 MiB per object; if an export fails, stop
the migration and address the backup failure before proceeding.

### Inventory (not yet completed)

| Project | Export checked | Offline copy | Restore dry run |
|---|---|---|---|
| Every active public/built-in project | Pending | Pending | Pending |
| Every personal/private project | Pending | Pending | Pending |

## Restoration limitations

The existing `/api/project/archive` POST **validates an import**;
it does not overwrite live records. The existing
`/api/project/staging` only stages a recovery copy in an isolated
R2 prefix and verifies checksums. The current code does not provide a
single-click live-project restore.

Implement and test an authorized, guarded **full project restore**
on a test copy *before* the functional-parts migration. It should
suspend edits, validate a matching project ID, preserve a rescue
snapshot of the post-migration state, restore a consistent set of R2
keys, reconcile stale objects, verify counts/checksums, and only then
release the write lock.

## Deployment / migration gate

- [x] Preserve exact pre-change code.
- [x] Create separate development branch.
- [ ] Obtain and verify current per-project data exports.
- [ ] Store at least one independent offsite copy.
- [ ] Test restoring an export onto a disposable project.
- [ ] Add explicit schema versioning and reversible migration for
      functional-part and implementation data.
- [ ] Verify Workshop links, BOM quantities, notes, photos,
      instructions, archives and custom parts after migration.
- [ ] Deploy new architecture only after all gates pass.

**Do not claim the current live R2 project data was backed up merely
because this code checkpoint exists.**
