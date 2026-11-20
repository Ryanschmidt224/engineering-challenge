# Infrastructure review — November 20, 2026

## Recommendation

This is a good time for a staged cleanup. Keep the existing website and stored
records. Repair the data-protection gaps first, establish passing checks, then
extract shared controllers and simplify styling. A framework rewrite would make
the data issues harder to distinguish from new regressions.

This review inspected the application source, API handlers, storage layout,
backup/export code, workflows, and tests against main commit
`924f194732747dba67daf7465e27fe036fea3962`. It did not inspect Cloudflare dashboard
settings, production logs, external firewall rules, or private user records.
Reproductions used local code and synthetic data, with no production writes.

## Findings, in recommended order

### 1. High — the backup manifest has fallen behind the data model

`functions/api/project-archive.js` maintains independent `folders()` and
`singles()` allowlists. They cover BOMs, workspaces, original attachments, notes,
and several older libraries, but omit newer storage namespaces.

The following representative keys were passed to the real `isAllowedKey()`
function. All returned false, while `components/launcher.json` returned true.

| Missing data | Representative storage key |
| --- | --- |
| Project catalog, including summary, tags, ownership, visibility | `project-catalog/v1.json` |
| Project title overrides | `project-settings/launcher.json` |
| Assembly status and attention notes | `assembly-status/launcher/assembly-a.json` |
| Suggestions and approval log | `change-proposals/launcher.json` |
| Editable image markup | `photo-annotations/launcher/photo.png.json` |
| Rendered marked-up images | `photo-renders/launcher/photo.png.webp` |
| Current shared Workshop overrides | `workshop-reference-overrides/v1.json` |

Linked Workshop photos and personal Workshop dependencies are also outside the
project export lists. Some values are copied into project records, but a live
lookup can supply newer prices, descriptions, documents, and fallback photos
that the archive does not capture. A readable HTML export consumes the same
archive, so it inherits its omissions.

**Change:** build one storage registry used by writes, exports, and recovery.
Export a project-scoped catalog record and only the dependencies that project
uses. Do not export the complete global catalog or another user's Workshop.
Capture linked reference metadata and required assets as explicit dependencies.
Keep old archive versions readable and introduce a versioned manifest for the
new coverage. Add fixture tests containing every persisted entity type.

**Acceptance:** a synthetic project with a summary, status, markup, Workshop
links, documents, notes, and code can be exported and reopened in isolation
without fetching anything from the live website.

### 2. High — uploads and work-instruction saves disagree about file types

`functions/api/recipe-files.js` accepts KiCad and code extensions, but
`functions/api/workspace.js` has a separate, older attachment regex.
Running its `validateRecipe()` on otherwise valid steps produced these results.

| Attachment extension | Step save accepted |
| --- | --- |
| `pdf` | Yes |
| `kicad_pcb` | No |
| `kicad_pro` | No |
| `ino` | No |
| `py` | No |

An upload can succeed and leave an object in storage while the containing step
cannot be saved.

**Change:** share the upload type registry and project-scoped asset validator
between upload, workspace, history, and export handlers. Check attachment
existence and ownership when saving references. Add upload-then-save tests for
KiCad, code, images, and PDFs, including failure/retry behavior.

### 3. High — automatic instruction history is only a rolling window

`functions/api/workspace.js` and `functions/api/proposals.js` use
`history.slice(-19)` before appending a snapshot. After enough edits, older
snapshots disappear from the active workspace record. This conflicts with the
requirement to preserve project history. Weekly backups may retain some earlier
states, but do not guarantee every intermediate edit.

**Change:** write immutable revision objects with stable IDs, keeping only a
small recent index in the workspace. Never delete old revision objects as part
of routine saves. Use a backward-compatible reader for existing embedded history.

**Acceptance:** after 50 saves, all 50 revisions remain discoverable, exportable,
and independently readable.

### 4. High — conflict protection is uneven

The tree, workspace, notes, code, and Workshop handlers already use conditional
R2 writes. That is useful existing infrastructure and should be retained.
However, component full edits and project summary edits do not require the
browser's loaded revision. Their server-side ETag prevents two overlapping
read/write operations from colliding, but does not reject a stale form submitted
after someone else's save has already finished. Assembly status writes are
unconditional.

**Change:** use a consistent client-visible revision contract for all editable
records. Send the loaded token with every mutation and keep a conflict copy of
the user's draft. Prefer small field patches when editing one field.

**Acceptance:** two clients load the same part or summary. The first saves. The
second receives a conflict without losing its draft or overwriting the first.

### 5. Medium-high — some operations span multiple objects without recovery

In `functions/api/proposals.js`, approval writes the workspace before updating
the proposal log. If the second write fails, the text is applied but the
proposal stays pending. Retrying then fails the original-text check. The handler
reports the partial failure, but does not reconcile it. Part deletion similarly
copies recovery data, updates the component collection, and deletes assets in
separate steps. Number allocation also precedes the final component/tree save.

**Change:** add operation IDs, explicit operation states, and retry/reconciliation
logic for these workflows. Use fault-injection tests after each write. If these
operations grow more complex, consider transactional storage for metadata while
keeping binary files in R2. A database migration should be separate work with
verified recovery, not bundled with a visual cleanup.

### 6. Medium-high — backups are not independent disaster recovery

`functions/api/automatic-backups.js` stores snapshots in the same R2 bucket as
the live project. Its comments correctly state that exports are not
transactionally consistent during concurrent edits. The exporter reads objects
sequentially without a project-wide snapshot boundary. Its limits are 1,500
objects, 24 MiB per object, and 72 MiB total. It holds binary data and base64
representations in memory and serializes the entire archive.

The configured weekly cron and Worker handler exist in source. This review
does not establish whether that schedule is active in production or when it
last succeeded.

**Change:** verify actual scheduled runs, record last success and failure, and
copy validated backups to independent storage. Test restoration in isolation.
Use a consistent manifest or detect revisions changing during export. For larger
projects, stream files or use a manifest plus separate blobs instead of growing
the single JSON envelope. Keep existing backups.

### 7. Medium-high — the checks are currently red and duplicated

`npm run check` completed with 155 tests, 152 passing and three failures.

| Failure | Review assessment |
| --- | --- |
| Theme forbids hardcoded colors | Real style contract drift |
| Feature-tree show/hide source assertion | Assertion no longer matches current UI/source layout |
| Workshop image-adjacent Edit assertion | Assertion expects an older implementation shape |

Three workflows (`ci.yml`, `verify.yml`, `website-checks.yml`) run substantially
the same check. A separate browser workflow uses a Python static server and
mocked API responses, which validates UI behavior but not a real Worker/R2
integration. The syntax command is a hand-maintained list that can miss new files.

**Change:** consolidate into one validation workflow, discover syntax targets
automatically, repair stale assertions while preserving their intended behavior,
and add integration tests for actual request routing and storage contracts.
Require passing checks before production deployment. Verify the existing
Cloudflare/GitHub gate configuration rather than assuming it is enforced.

### 8. Medium — shared code still has too much shared mutable state

`assets/site-assembly.js` has approximately 2,940 lines in one controller,
covering tree navigation, quantities, part editing, summaries, settings,
attachments, permissions, and saves. Classic scripts depend on load order and
globals in `index.html`. Part and assembly saves have parallel implementations
with their own revisions and pending-request state. Modules add document/window
listeners without a common disposal contract.

**Change:** extract a request client, project store, shared workspace controller,
part-detail controller, tree controller, and navigation lifecycle in small
steps. Pass dependencies explicitly. Provide `mount()`/`dispose()` for listeners
and observers. Use request scope/version checks so a late response cannot mark
a newly opened page as saved. Reuse the same controller for part and assembly
pages, with different storage adapters.

Keep the existing pure modules for BOM rules and part fields. Build on those
instead of moving calculations back into DOM handlers.

### 9. Medium — styling is an accumulating override stack

The four `site*.css` files total roughly 5,900 lines. Their cascade includes
overlapping rules, historical layouts, and specificity/`!important` overrides.
This helps explain why the same page changes keep needing follow-up alignment
fixes. The completion mark was an example: a pseudo-element after a block-level
description created a third line in every completed tree row.

**Change:** define shared section-header, action-link, disclosure, detail-row,
and sidebar-navigation components with one owner per selector. Remove superseded
rules only after comparing part, assembly, summary, and Workshop screens at
desktop and narrow widths. Do not merely append a fifth override stylesheet.

The completion marker has been changed in this patch to a small inline element
after the name, before the description, with a tooltip and accessible status
label. The attention flag retains priority.

### 10. Medium — deployment and asset versions rely on manual bookkeeping

`index.html` mixes unversioned scripts with manually dated query strings.
`wrangler.jsonc` uses the repository root as its assets directory. This review
does not establish which external production build settings restrict publication
or gate releases.

**Change:** generate an explicit public build directory and a content-hashed
asset manifest. Publish only intended public files. Document the single supported
deployment path, validate source-to-deployment identity, and keep a rollback
check. Code rollback and data restoration must remain distinct operations.

### 11. Medium — account and AI resource limits need infrastructure verification

The account handler has signed, HttpOnly sessions and salted password hashing,
but no application login/registration throttling was found. External Cloudflare
rules may exist and were not inspected. Sessions share the legacy admin secret
as their signing key. AI usage is read before a paid lookup and incremented only
after success with an unconditional write, so simultaneous lookups can exceed
the intended daily counter and failed paid requests are not reflected in it.

**Change:** verify edge throttling, add explicit account/IP limits where absent,
separate session signing from the administrator password, and reserve/reconcile
AI usage atomically before outbound work. Keep session-key rotation compatible
with an intentional sign-in transition.

## Suggested sequence

1. Repair backup coverage, attachment validation, and indefinite history.
2. Standardize conflict detection and recoverable multi-object operations.
3. Restore passing checks and verify deployment gates and scheduled recovery.
4. Extract shared controllers and consolidate component styles incrementally.
5. Introduce generated public assets and evaluate transactional metadata storage
   only when the measured concurrency/scale justifies it.

For each phase, retain stable IDs and old readers, use synthetic migration and
restore fixtures, and deploy separately. No live records were migrated or
deleted during this review.
