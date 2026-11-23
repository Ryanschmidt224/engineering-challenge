# Project engine command foundation

Status: **Batch 1 real Cloudflare D1 proof passed**, November 22, 2026 (Arizona). The initial run and same-proof replay passed all seven checks with unchanged counts. Exact source, binding, build ID and reports are recorded in `PROJECT_ENGINE_D1_PROOF.json`. Batch 2 dependent preview flows may now begin. This is not the completed custom-part application or production cutover.

## Ownership and boundaries

- `project-engine-migrations.js` has its own numbered ledger and additive minimal tables for projects, custom items, root occurrences, immutable configurations/events and operation receipts. It neither imports nor changes legacy projects, Workshop or Knowledge.
- `project-command.js` serializes a single-owner project through one opaque project revision token. This conservative aggregate guard may reject unrelated simultaneous edits in two tabs; it keeps the first slice simple and prevents stale forms from overwriting changes. Editors must retain their drafts on 409. Later restore generates fresh tokens.
- `project-engine-proof.js` establishes the foundation gate. After that gate passed, the custom-part API also began using the primitive; see `PROJECT_CUSTOM_FLOW.md`. The proof creates one clearly named disposable project per proof ID and leaves its D1 rows for inspection. It writes no R2 objects and never deletes data.
- `project-engine.js` requires the preview flag, the existing owner account and same-origin writes. There is no signup, fixture login or authentication bypass. `/project-engine-proof.html` reuses the site header and kit; it has no custom CSS.
- `NEW_PROJECT_ENGINE=1` exists **only** under `previews.vars`. Production API and proof-page paths return 404 before authentication, migrations or assets. Enabled preview paths require sign-in (401). The production 404 takes precedence over the signed-out 401 described for enabled routes in F11.

## Independent custom-part model preparation

`assets/project-item-model.js` is pure validation/comparison code, used by the existing proof fixture. It has no DOM, network or storage access and introduces no new caller of the transaction primitive. The real D1 gate has passed. The model is now shared by the dependent custom-part commands; their separate acceptance status is recorded in `PROJECT_CUSTOM_FLOW.md`.

- Custom details validate name/short name/kind/number, optional description/purpose/acceptance/manufacturer/MPN, explicit tool state and stable specification IDs. Empty optional text is omitted. Specification values preserve zero, false, empty text, null and an absent value distinctly; nothing guesses a value or converts units.
- Occurrence quantity, unit, status, attention/note and tree-hidden state are validated separately. Build information cannot silently become intrinsic engineering data. A disabled attention flag does not erase its note.
- Automatic numbering uses the project's prefix and minimum digit count (current default NR/3), begins at 100 and takes every reserved number, including archived items. It neither changes old numbers nor establishes database uniqueness by itself; final commands must still use the D1 guard/constraint.
- Revision comparisons match specification rows by stable ID. They show changed values with labels and old/new units, added/removed rows, label changes and ordering. Equivalent blank optional fields yield no change. Equal labels do not conflate separate rows.
- The proof fixture now uses this same model. Its revised configuration matches the saved current fields, retains the unchanged specification rows and leaves the initial configuration at 3 mm. SQLite tests verify this; the actual preview proof passed and its report is retained.

The custom-part preview now adds record/step commands, immutable files, History queries and export/restore. Its UI and actual Cloudflare acceptance remain separate from the passed foundation proof; see `PROJECT_CUSTOM_FLOW.md`. No existing production project record or path is changed.

## Exact write contract

1. Validate project/operation/revision IDs. Fingerprint the canonical JSON request, including owner, project, loaded revision and action payload. Types, zero, false, empty and missing values stay distinct.
2. Look up the scoped operation receipt **before** a revision comparison. A same-body retry returns the saved result; different content under that ID returns 409.
3. Generate a fresh server attempt ID and next opaque revision. The builder creates guarded statements and adds any child/source preconditions to admission. No storage side effects occur while building.
4. In **one** D1 `batch()`, insert the receipt only if the project belongs to the owner at the expected revision (or does not exist for creation), plus every child/source guard. A uniqueness conflict does not admit a second attempt.
5. Every header/domain/configuration/event statement contains an `EXISTS` check for this receipt's **fresh attempt ID**. A zero-row admission therefore makes every dependent statement a no-op. An earlier retry receipt cannot authorize them. Updates also require their exact target in admission; identities and receipt/configuration/event updates are unavailable through the writer.
6. A later SQL failure must roll back the receipt, header and all dependent writes. If admission made zero changes, look up a racing committed receipt for replay; otherwise return 409. An unchanged save must return before this primitive; it must not create a receipt.

All domain IDs and the result are chosen once per admitted command and returned from its receipt on retry. Number uniqueness includes archived items. Composite keys prevent an event/configuration/occurrence from pointing at a different project's item. The custom-part commands now apply domain validation after the passed D1 gate. The foundation proof alone does not establish the complete workflow.

## Preview authentication prerequisite

A fresh preview was created after the owner configured Previews Base bindings and its separate session-signing secret. Its account service now returns the normal signed-out response. The isolated preview owner was provisioned by the owner using the offline helper, then authenticated through the unchanged account handler. Production login records were not copied.

For an empty preview account store, use the one-time operator procedure in `PREVIEW_OWNER_SETUP.md`. The self-contained HTML helper stays under `scripts/`, excluded from deployed assets. It creates no server endpoint and keeps the existing authentication boundary. Account generation/upload is not itself proof of D1 transactions.

## Proof to run on the actual preview

1. Confirm the deployed branch/version is this exact PR head. In Cloudflare's preview bindings verify `WORKSHOP_DB` targets `building-schmidt-workshop-preview` (`3314f42f-7c04-4798-99dc-b5b97c4fb82f`), `PHOTOS` targets `building-schmidt-photos-preview`, and the flag is present only for previews. Preview authentication secrets/account provisioning may need existing Cloudflare configuration; do not copy production data, expose credentials or reopen registration as a shortcut.
2. Sign in as the existing preview owner through Account on Projects. Open `project-engine-proof.html` on the **branch preview**, not the production hostname. Click **Run preview D1 proof**.
3. Save the returned JSON with its preview URL, exact deployed source SHA, Cloudflare deployment/build ID and checked-at timestamp. A 200 report must contain seven passing checks and counts of one event, two configurations and three receipts. Click **Recheck the same proof** and verify the same project ID/counts.
4. The proof executes stale admission, missing-child admission, a successful revision, lost-response retry, ID/body mismatch, and an actual late foreign-key failure against that binding. It compares all six tables before/after rejected commands, including the project token and receipts. Local SQLite and browser fixtures execute the same code but **do not satisfy this live gate**.
5. Confirm unsigned preview API/page requests return 401, wrong-origin writes 403, and production counterparts 404. Only then begin Batch 2 custom-part editing, records, immutable files, History and export/restore. Do not call those flows complete on the strength of this foundation test.

## Rollback

Before merge, keep this branch and its preview separate from the live cleanup. Production's new-engine flag remains absent. A code rollback reverts this foundation PR; do not drop tables, remove proof rows, delete R2, reseed D1 or alter Workshop/account data. To stop preview writes immediately, disable its flag through the reviewed preview configuration and redeploy. Preserve any proof report and rows for diagnosis. A schema correction is a new numbered migration, never an edit to an applied migration.

Cloudflare reference: https://developers.cloudflare.com/workers/previews/configuration/ (preview bindings/vars are independent of production; checked November 22, 2026).
