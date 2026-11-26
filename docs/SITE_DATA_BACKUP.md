# One-click whole-site data backup

On Projects, click **Backup all data**. Supported browsers open the system save picker immediately with `BuildingSchmidtDataBackup-YYYY-MM-DD.bsbackup` (Arizona date). The file is streamed directly to the selected destination and committed only after its completion marker and SHA-256 chain verify. Canceling the picker does not start an export. Other browsers use their normal download/save behavior.

The owner-only read-only export includes all application D1 table definitions/rows/indexes/triggers/views from WORKSHOP_DB and every PHOTOS R2 object, including current and legacy projects, Workshop, Info Bits, account data, files, photos and stored backups. It does not call migration/cleanup/delete handlers, create another server-side backup, change retention or call paid AI. Cloudflare-internal tables are excluded. Deployment environment secrets and DNS/account configuration are not application data and are not embedded; source remains versioned in GitHub. The archive records the available deployed version ID.

The save-picker export uses multiple bounded authenticated read requests, behind the same button, to avoid one long Worker request. Data rows and object bytes are streamed in bounded pages/chunks rather than collected into one Worker or browser buffer. Object metadata includes storage keys, HTTP/custom metadata, size and ETag. A rolling SHA-256 chain covers every entry. A final re-read compares database content and object inventory; detected concurrent edits interrupt the export, and the save picker aborts the destination rather than reporting success. This is not a cross-service transactional snapshot: run it while not editing. A browser falling back to native downloads may leave an interrupted partial file; a file without a valid completion marker is not a backup.

Verification/recovery preparation:

```
python scripts/verify-site-backup.py BuildingSchmidtDataBackup-2026-11-25.bsbackup
python scripts/verify-site-backup.py BuildingSchmidtDataBackup-2026-11-25.bsbackup --extract recovery-files
```

The optional extraction creates SQL and object files plus a key/metadata mapping in a new directory. It does not execute SQL, access the network, or overwrite any live website. Whole-site restore is an operator recovery operation into isolated D1/R2 before any production replacement; it is deliberately not a one-click destructive action. Keep the downloaded backup private: it includes private project and account records.

Permanent project deletion remains permanent inside the website, including its automatic backups. It cannot remove independent files previously downloaded to a computer. The backup button never runs automatically before deletion and does not block deletion on a download.
