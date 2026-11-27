> Historical checkpoint. See [current status](../STATUS.md) and the [combined review plan](../WHOLE-SITE-REVIEW-2026-11-27.md). Earlier rollout gates and retired feature instructions do not apply.

# Workshop AI reliability release — November 26, 2026

Released in PR #131 after the pending-only forget fix and passing checks. This implements audit findings 4, 12, 13 and 14. The Workshop visual redesign is recorded separately as a future upgrade. Routine Claude reviews remain off. Claude approved this candidate after one required correction: an unconfirmed document must be forgettable. That correction is implemented and the release evidence is recorded on PR #131.

## Result

- Current Workshop lookups use an explicit `workshop-template-v1` response: template ID/revision, exact stable field IDs, typed values, conditions and per-value sources. Unknown IDs, missing IDs, incompatible units/types and unsourced values cannot populate fields. Multiple ratings for one field require an explicit choice. Existing filled values are not selected for replacement automatically.
- The retained legacy lookup contract remains separate. No label-based translation of legacy research into current template fields. Identity matching, owner-only access, explicit Apply/Save and the existing lookup quota remain. Provider/model/billing configuration is unchanged. Tests mock provider responses; no paid live research was performed.
- Additive Workshop migration 4 adds `workshop_products.lookup_provenance` as a bounded JSON column, empty for existing products. It stores the explicit AI-assisted marker and exact applied field value/label/unit/conditions, source URL and/or source-document name/SHA-256. The server enforces complete identity and HTTPS supplier URL for marked products after reopening, including when a caller omits metadata. Manual products remain manual; old products are not classified by guessing from their text.
- Conditions/sources display beside saved specifications. A manually changed value loses its old AI attribution, while unchanged facts retain theirs. Renaming a template label retains evidence under the stable field ID. This is user-reviewed AI provenance, not a signature or a claim that a source is authentic.
- Project admission freezes evidence into the existing Workshop selection snapshot, alongside copied file references. Later Workshop edits cannot rewrite project evidence. Copied document references resolve to project-owned file IDs; the source document's name and hash remain. Existing custom-part storage is unchanged. Projects with an unconfirmed Workshop source upload wait for that upload to complete before copying that product.
- A pending document can be explicitly forgotten in the editor, including after reopening. Sending `documentUpload: null` removes only a prior pending descriptor; it cannot remove a saved descriptor. This clears the copy blocker without deleting saved files or changing the AI source evidence.
- Datasheets have a durable pending/saved descriptor and stable upload ID. Product save, byte upload and final status confirmation are explicitly separate. A lost upload response is retried with the same ID; a lost final-status response is reconciled by reading the committed record. Pending state survives a page reload, with instructions to reselect the same file. A new partial save updates the page URL to its saved product. The file must exist on that product and match its hash before completion is accepted.
- The complete file bytes are not cached in a browser database: after a reload a pending file needs reselection. Already uploaded bytes can confirm the pending save through the existing saved-document selector, without another file upload. No background retry or automatic AI request is added.

## Shared-control cleanup

`file-selection.js` centralizes file drop/native paste handling for current Workshop technical documents, project galleries and entry attachments. It retains each owner's admission, queue, revision and upload rules. Entry attachment controls use the existing compact button/drop row. The retained classic photo-upload panel remains its existing shared adapter; this is not a wholesale legacy conversion.

Merged the duplicate pencil rule and removed the obsolete large direct-child drop-zone CSS; the actual shared panel places its compact drop target in the button row. The pencil's position and graphics are preserved. No new specificity or forced overrides, and frozen legacy JavaScript budgets remain enforced. JavaScript pencil alignment and the broader legacy CSS cascade remain separate follow-ups.

## Review and validation boundaries

Review the metadata migration and preservation behavior, identity-marker persistence, truthful per-field/document attribution, upload partial-save recovery and cross-project isolation. The new column is additive; no existing rows or storage objects are deleted or migrated into another owner.

Native local workerd/D1 tests upgrade a populated Workshop v3 database, cold-restart it and check evidence and foreign keys. The full isolated D1/R2 recovery proof now includes AI provenance; Workshop catalog recovery also round-trips the new JSON column, and project backup/import checks the frozen evidence and copied document hash. Older backups without provenance restore with the empty-column default; exports with the new column require the current Workshop restore tool (older tools fail closed on unknown columns). Browser regressions cover current lookups, stale results, duplicate ratings, conditions after reload, required identity, lost upload and completion responses, saved document reuse, gallery controls and phone layout.

The tests are synthetic/local and CI checks. No manual production migration, destructive action, real-user lookup or paid OpenAI call was used in validation. The released application retains its normal additive initialization on use. A passing preview build alone does not imply a real hosted AI research acceptance test.

Local candidate validation: 510 code checks passed. Browser regressions also cover forgetting a pending document in the current editor and after reopening, then admitting the product to a project. The final-head GitHub code/browser checks and Cloudflare preview results are recorded on PR #131.

Release evidence: #131 merged at `274f454437821c8155d341a44fd395e4fd05c3b1`; 510 Node checks and 233 browser workflows passed. Production build `4a8afe59-1717-41e7-8100-8936c9c01916` succeeded, deploying Worker `3e8237d6-ea7e-4249-8084-ad179c9d9425`.
