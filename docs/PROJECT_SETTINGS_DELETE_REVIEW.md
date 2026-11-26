# Project owners and permanent deletion — Claude review required

Owner requests (Nov 25): add full Delete project to Project settings; select Ryan/Wes/Wyatt when creating a project (Ryan default); allow the Projects screen to filter by owner. No existing production project is selected or authorized for deletion by this implementation task.

## Release boundary

This sensitive deletion PR is held for owner review under the latest policy. Routine Claude review is discontinued. Review migration 14, storage fences and irreversible deletion before release. Owner controls and full-page Settings are separate in #109; templates are merged in #107 and CSS cleanup in #108.

## Owner selection and filtering

New project and Project settings use the same Ryan/Wes/Wyatt choices. Ryan is the default, including for existing projects through the new column default. The owner name is descriptive project metadata; the existing private account owner_id, sign-in and authorization remain unchanged. Directory owner chips and its All owners/Ryan/Wes/Wyatt filter reuse the directory's tag filtering, combining with search, sort and view preferences without writes. Filter preferences persist locally.

Small and streamed project exports carry owner_name. Restore preserves the choice; an older backup without it defaults to Ryan, and an invalid supplied choice is rejected. No numbered revision/evidence payload is rewritten.

## Explicit permanent deletion

Project settings contains a collapsed Delete project section. Its danger button opens a shared-style confirmation dialog requiring the exact saved project name. The dialog explains that parts, instructions, files, history and automatic backups on this website will be removed, and that the operation cannot be undone. Reusable Workshop templates/products and other projects are separate. Cancellation before confirmation performs no write.

The private owner-only POST /api/project-engine/projects/:id/delete takes the loaded revision, UUID operationId and exact name. Admission uses the existing atomic command/receipt mechanism: a stale project version or incorrect name cannot start deletion. The operation inserts one project-scoped deletion tombstone and advances the project revision in that transaction. Job identity/hash are immutable; completion cannot be reset and the tombstone cannot be removed. It stores IDs, request hash and timestamps, not the project name or project content.

Once admitted, normal state/file reads and writes are blocked. SQL INSERT/UPDATE fences also block racing commands, restore jobs/staged rows and recreation of the same project ID. A pending directory card says Deleting and reopens the same deletion operation with its original token. A lost response retries the same body; a different operation cannot hijack the job. The UI can resume after a storage failure without claiming rollback.

## Exact storage scope and deletion order

Only these three UUID-scoped R2 prefixes are removed:

- project-engine/files/:projectId/ (original and prepared bytes)
- project-engine/restored/:projectId/ (independent imported copies)
- automatic-backups/engine/:projectId/ (this website's automatic backup objects)

Each request lists from the start and removes at most 100 objects. A moving positional cursor is not reused after a page is deleted. Unexpected/incomplete or out-of-prefix listing results fail closed. Unexpected file-key namespaces or linked legacy Workshop uses refuse admission before any deletion; this feature targets new-engine projects, not legacy cleanup.

After all three prefixes list empty, one D1 batch removes the project's media, file links, records, events, configurations, selections, snapshot values, steps, occurrences, archive groups, files, items and operational receipts; clears its restore-staging JSON; removes its project header; and marks the deletion complete. Every statement uses the exact admitted job/project/account scope. D1 failure rolls this metadata batch back; R2 objects already removed do not come back, and retry must finish the job.

Minimal deletion/retirement fences and restore-job identities/fingerprints are retained as technical tombstones. Released migrations 1–11 and the schema-9 permanent retired-key/object-intent rules are unchanged. No reusable Workshop record, legacy source project, other project's bytes, or downloaded/off-site backup copy is erased. The project content itself and its website automatic backups are removed; this is not an Archive operation.

## In-flight writers and continued cleanup

Uploads check the deletion fence around R2 puts and remove their own late bytes when deletion wins during a put. Scheduled backup creation checks after its store and removes a late backup instead of publishing success. The existing scheduled invocation advances at most five explicitly admitted deletion jobs per run, rotating by last_swept_at; it also revisits completed tombstones to remove bytes left later by an older in-flight writer. No new schedule, generic prefix-delete endpoint or general orphan cleanup is introduced. A post-put removal failure can therefore leave transient late bytes until retry/the scheduled sweep; do not claim instantaneous cryptographic erasure.

## Rollback limits

Deletion is irreversible once admitted. Do not offer a cancel/undo after admission. A separately downloaded backup can be restored as a new project with a new ID; the deleted ID stays retired. There is deliberately no automatic pre-delete backup because the owner requested full deletion, including the website's backups.

Engine schema 14 is additive but the engine's existing newer-schema guard prevents an older schema-13 Worker from opening it. Roll code forward with a schema-14-compatible fix; do not claim that redeploying the old Worker reverses this migration or restores deleted data. All production data remains unchanged while this PR is held.

## Verification and review checklist

Local proofs cover owner defaults/validation/stale saves; new/old backup restore; full scoped content/object removal; wrong name/version/actor and signed-out refusal; partial R2 failure; atomic metadata rollback/retry; pending-directory resume tokens; in-flight upload and backup races; late-object sweeps; restored-project staging removal with an unchanged independent source; forged cleanup refusal; and immutable tombstones. Browser checks cover all three owner choices, edit/filter/search persistence without writes, typed-name confirmation/cancellation, preservation of another project and exact-operation retry after a lost deletion response. Existing full Node/browser/Cloudflare checks must pass on the final candidate.

Claude should especially inspect:

1. Admission ordering, project revision serialization, duplicate/replayed operation behavior and authorization/CSRF.
2. R2 prefix boundaries, incomplete-list refusal, retry after partial deletion, and old/in-flight writer handling.
3. D1 foreign-key deletion order and the retained technical fences versus actual project-content removal.
4. Owner-name backup compatibility, old-worker rollback limits and pending-deletion directory UX.
5. The legacy Workshop-use refusal and the absence of any automatic deletion of an existing production project.

No production deletion or schema-14 migration has been run. After technical review, run a disposable-project proof against the isolated Cloudflare D1/R2 preview before production rollout; local SQLite/R2 fixtures and a successful build are not that platform proof.

Owner policy: routine Claude review is discontinued. Permanent deletion is specifically flagged for owner review because it irreversibly removes project files, content and backups. This PR remains held pending that sensitive review and an isolated Cloudflare data-path proof.

Owner confirmation Nov25: delete every project backup and stored project object. A separate manual whole-site download (PR #112) provides an independently saved backup when the owner chooses; it is neither automatic nor a deletion prerequisite. Claude review 87b3212 approved subject to adding the project-engine/workshop namespace. That prefix is now included and a copied-Workshop-attachment regression is added. Retain completed tombstone sweeps: these catch late bytes from an already in-flight older writer.
