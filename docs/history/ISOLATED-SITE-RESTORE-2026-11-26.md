> Historical checkpoint. See [current status](../STATUS.md) and the [combined review plan](../WHOLE-SITE-REVIEW-2026-11-27.md). Earlier rollout gates and retired feature instructions do not apply.

# Whole-site isolated restore rehearsal — November 26, 2026

The full data-restore rehearsal passed in two independent local Cloudflare workerd environments using native D1 and R2 bindings. Production was untouched. The source and target used different database IDs, bucket IDs and persistence directories; the target began empty.

## Result

| Check | Observed result |
| --- | --- |
| Database | 31 tables and 570 rows reconstructed; every stored row compared with the source |
| Table coverage | 30 application tables plus a scalar-type probe for BLOB, Unicode, quoted/multiline text, numbers and null |
| Object storage | All 6 objects restored with matching SHA-256 bytes and HTTP/custom metadata |
| Object coverage | Owner account records, a legacy object over 1 MiB, project photo, Workshop datasheet and an actual automatic project backup |
| Application | 9 authenticated API routes compared with the source after a target cold restart |
| History | Instructions, written records, numbered part revision and configuration evidence retained |
| Downloads | Project photo, Workshop datasheet and automatic project backup downloaded successfully |
| Authentication | Fresh owner password sign-in succeeded; an unauthenticated project request was denied |
| Database integrity | `PRAGMA foreign_key_check` returned no errors |
| Independence | Target project edits and a target-only R2 write left the source unchanged |
| Scheduled-backup state | The restored automatic-backup list/download worked; the next run recognized the unchanged project |

## Procedure exercised

1. Compile the current Worker into a disposable local workerd environment and create a synthetic owner through the existing fixture provisioner. Supply deployment bindings and a synthetic signing secret separately.
2. Populate the actual Workshop, Info Bits and new-project APIs. Create a part, instruction, written record, numbered revision, photo and datasheet. Run the real automatic-project-backup implementation. Include a large legacy object and scalar-value probe.
3. Download the complete version-1 archive through the same authenticated paged interface used by the Settings backup control.
4. Run `scripts/verify-site-backup.py` and extract its SQL and object inventory after verification succeeds.
5. Split complete SQL statements using SQLite's statement parser. Strip generic SQLite transaction/foreign-key wrappers and execute the fixture import as one D1 batch with `PRAGMA defer_foreign_keys=ON`.
6. Restore each R2 object's bytes and metadata. Reconstruct serialized cache-expiry dates as the Date type required by the R2 binding.
7. Stop and restart the target Worker, then perform the checks above. Finally dispose of both environments and remove the temporary archive and stores.

## Defect found and corrected

The initial recovery SQL created indexes after inserting data. Some engine foreign keys depend on separately declared unique indexes, so D1 refused restoration with `foreign key mismatch - "engine_records" referencing "engine_configurations"`.

Recovery SQL now creates all tables, then indexes, then inserts rows, then creates triggers/views. D1's deferred foreign-key checks can resolve row dependencies at transaction completion. Historical-data protection triggers are installed after loading the preserved rows. The archive format and stored production data are unchanged.

## Repeat the rehearsal

After installing the pinned development dependencies:

```sh
node --test tests/site-backup-recovery-runtime.test.mjs
```

The test emits one `ISOLATED_RESTORE_PROOF` summary. It is included in the normal Node checks. `tests/helpers/recovery-sql.py` is a fixture loader used only with the newly created local target.

## Recovery boundary

This proves restoration of a representative complete synthetic site in the local Cloudflare runtime. Hosted-account import and production-snapshot restoration were not performed. The test's single-batch import is not a general-purpose large-database import tool.

An actual deployment recovery also needs the repository/build, D1/R2 bindings, account access, environment variables/secrets, feature flags, domains/DNS and cron configuration. Keep that configuration available separately from the database/files archive. The rehearsal supplies its synthetic signing secret independently and verifies a fresh login after recovery; it does not obtain production credentials.

For a hosted disaster recovery, use new isolated target resources, confirm the target configuration and capacity, import and verify all data/files, test authentication and application behavior, then explicitly decide on any production cutover. Preserve the source until that separate operation is accepted.
