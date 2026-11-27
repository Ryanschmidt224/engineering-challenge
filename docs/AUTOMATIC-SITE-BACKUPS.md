# Automatic whole-site backups

The daily 02:17 Arizona job creates a consistent `.bsbackup` of D1 user tables and R2 source objects: Projects and immutable history/files, Workshop, Lessons Learned, account records, and retained legacy data. It does not initialize or migrate a database. Project-only archives continue as a separate recovery option.

## Publication and retention

- Seven latest verified copies are retained. A failed attempt does not replace a good copy. These copies share the website's R2 account and are not an independent/offsite backup.
- The archive is streamed in fixed 8 MiB blocks and reread in full. Publication requires the stored size and SHA-256 block-chain digest to match the generated stream. The normal archive's line checksums, database/inventory verification and completion marker remain intact; the existing offline checker reads it without a new archive version.
- Each archive is limited to 512 MiB; source limits are 2,000 objects, 100,000 database rows and 200 inventory pages. Exceeding a limit fails visibly and preserves older copies. The writer also checks a 12-minute work budget. The existing Worker CPU limit and platform invocation limits still apply; local performance does not measure hosted CPU.
- Index updates are conditional. One expiring run lease fences writes/publication. Duplicate, overlapping and older runs cannot publish over the current writer. A terminated run becomes unconfirmed after its 20-minute lease. A successful check is overdue after 36 hours.
- Multipart identity is saved before any part bytes are uploaded. The next admitted run aborts a tracked abandoned upload before starting another. Every mutation stays in `automatic-backups/site/`; only generated snapshot keys in that namespace are rotated. Pruning rereads the catalogue and lease before deletion.
- A crash after publication or a lost response preserves the published object. The next run removes unreferenced candidates before creating another copy. Cleanup failure stops further growth and is reported; previous verified copies remain downloadable.

Automatic archives exclude `automatic-backups/`, including other snapshots, per-project backup copies and monitoring records. Their source data is captured directly. Manual whole-site export excludes only the new `automatic-backups/site/` namespace, retaining its previous per-project-backup coverage. This prevents backups of backups without deleting source objects or historical records. The manifest records the exclusion policy, and the offline verifier preserves it in `backup-info.json`.

Permanent project deletion still removes current project data and per-project backups. Whole-site and downloaded backups can retain an earlier copy until those backups are replaced. Backup rotation does not purge live files, existing project archives, legacy storage or manually downloaded copies.

## Download and independent recovery

Website settings → Data backup lists the verified copies and their sizes/times. Downloading requires the owner session; altered/missing objects are rejected. A failed status does not hide earlier verified copies. Backup all data still saves a manual whole-site export directly to the owner's device.

Keep a checked copy outside the Cloudflare account. A bucket-level/account loss can affect the website and its automatic copies together. Restoring an entire older site deliberately returns its account/project/notebook records to that point; the monitoring history is excluded from automatic copies, so restored installations start without a false successful-backup history.

An actual disaster recovery needs the repository and deployment configuration separately:

1. Download a `.bsbackup` and run `python scripts/verify-site-backup.py COPY.bsbackup --extract NEW_EMPTY_DIRECTORY`. This streams verification and creates `database.sql`, `objects.json`, `backup-info.json`, and original object byte files. An existing extraction directory is rejected.
2. Recreate independent D1/R2 stores and the Worker configuration from the repository's `wrangler.jsonc`. Supply the account/session signing secret and deployment secrets separately; they are not recoverable from this data archive. Keep owner access private.
3. Import the extracted SQL using the D1-compatible ordered statements/deferred foreign-key transaction demonstrated in `tests/helpers/recovery-sql.py` and the native recovery test. Restore objects using their exact keys, bytes and metadata from `objects.json`. Never run recovery SQL over the current live database as a casual test.
4. Restart against the independent stores, check foreign keys, log in, and verify project revisions/history, Workshop documents, Lessons/photos, original file downloads and independent writes. Re-establish scheduled backups and create a fresh verified copy before considering recovery complete. Review credentials/session validity appropriate to the recovered account state.

The native test performs these steps in isolated local Cloudflare runtimes for both manual and automatic archives. Its automatic case advances through notebook-only and Workshop-only changes without a project revision change, restores them, checks cold restart and downloads, recovers an abandoned multipart upload, then produces a new automatic backup. A separate 110 MiB source test checks bounded streaming/read-back under the native Worker runtime. These tests do not claim a production cron fired, a production snapshot was restored, or an independent owner copy was stored elsewhere.

Implementation: `site-backup-state.js`, `site-backup-storage.js`, `site-auto-backups.js`, `automatic-site-backups.js`; scheduled orchestration: `scheduled-backups.js`. Exact candidate/check/deployment evidence belongs to the release PR.

Cloudflare API references used for the implementation:

- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- https://developers.cloudflare.com/r2/api/error-codes/
- https://developers.cloudflare.com/workers/platform/limits/
