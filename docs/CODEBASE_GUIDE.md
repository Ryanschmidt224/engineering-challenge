# Building Schmidt — codebase guide

Private owner application on Cloudflare Workers with D1 metadata and immutable R2 files. `docs/STATUS.md` owns release status; this document owns the code map. The retired R2 project application is no longer an implementation or rollback target.

| Owner | Entry points / modules | Responsibility |
| --- | --- | --- |
| Current project app | `project.html`, `assets/project-workspace.js` | Directory, navigation, current part/assembly screens and retained drafts |
| Project views | `project-tree-view.js`, `project-bom-view.js`, `project-instructions.js`, `project-history-view.js` | Presentation over current project identities and placements |
| Owner account | `site-header.js`, `project-signin.js`, `functions/api/accounts.js` | One Account menu and current-page owner dialog; existing account/session format |
| Global settings | `website-settings-page.js`, `website-settings-client.js` | Tags, owner labels, refresh without replacing drafts, backup/restore entry points |
| Workshop | `family-workshop.js`, `workshop-db.js` | Current families/products, evidence and current project-use projection |
| Lessons Learned | `lessons-learned.js`, `lessons-model.js`, `functions/api/lessons-learned.js` | Notebook steps, autosave with revisions and retry identity, title links, archive/restore and photo ownership |
| Calculators | `calculators.js`, `calculator-directory.js`, `calculator-catalog.js` | Independent calculators embedded in Lessons Learned or opened standalone |
| Project photos | `project-media.js`, `functions/api/project-media.js` | One ordered component for summaries/parts/assemblies; first photo is main; old standalone pictures remain readable |
| Photo tools | `photo-editor.js`, `clipboard-files.js`, `file-selection.js`, `photo-controls.css` | Image-stage disclosure and native choose/drop/paste; no storage API inference |
| Project commands | `project-workspace-api.js`, `project-command.js`, `project-*-commands.js` | Owner checks, revision/operation IDs, atomic admission and data changes |
| Project files and recovery | `project-engine-files.js`, `project-backup*.js`, `project-restore-*.js` | Immutable uploads, full metadata/files and independent restores |
| Nightly monitoring | `functions/api/automatic-backup-status.js`, `assets/automatic-backup-status.js` | Conditional durable run status, missed/interrupted/failure reporting, explicit project-only coverage |
| Automatic whole-site backups | `site-auto-backups.js`, `site-backup-state.js`, `site-backup-storage.js`, `automatic-site-backups.js` | Leased, bounded, verified whole-site snapshots, retention and owner download list |
| Whole-site recovery | `site-data-backup.js`, `scripts/verify-site-backup.py` | Consistency-checked D1/R2 archive and offline validation/reconstruction |
| Shared visual rules | `theme.css`, `ui-kit.css`, `components.css` | Tokens, controls, field rows, section headers and cards; shared `.ui-editor-group` / `.ui-editor-fields` styling for project and lesson editors |

Browser modules should declare dependencies and initialize explicitly. DOM helpers remain safe to import into pure model/export checks; importing a helper must not bootstrap the UI or require `window` before use. `window.BSUI` is the current UI-kit bridge; current photo/clipboard helpers are named ES-module exports, not a retired global service.

## Persistence contracts

- Project item identity is separate from placements. Quantities, status and assembly membership belong to placements. Workshop selections freeze data into the project; editing a project never updates the catalog.
- A command carries its original operation ID and expected revision. A transport retry replays that command. A conflict requires review, preserving the losing draft.
- Uploaded file IDs/bytes and captured historical evidence are immutable. Preserve deletion tombstones, retired-operation fences and restore staging/publication checks.
- Only authenticated validated project entry initializes the project schema. Workshop/Lessons reads can check readiness without creating project tables. Applied migrations are historical upgrade steps: add a new migration for a schema change; do not edit old ones.
- Current project archives and whole-site archives keep their existing formats. Older current-engine snapshot formats and downloaded readable exports remain supported. Stored archival bytes are data, not a reason to keep retired application controllers.
- Projects is the only project implementation and has no rollout variable. Retired API names have a small protected 410 boundary and no handler dependencies. Exact current API routes belong to `functions/api/api-routes.js`; prefix project routing remains in the Worker.
- Historical tile/link rows are export-only through `knowledge-archive.js`. The offline Workshop archive validator/restore retains old formats. Proof UI and synthetic commands live under `tests/`, excluded from production assets and imports.

## Checks and maintenance

`npm run check` checks syntax, module budgets, incremental formatting, CSS owners/producers and current regression tests, including native local Cloudflare D1/R2 recovery. `npm run test:browser` runs current owner workflows. Retired tests were removed with their feature owners; current backup/restore, history, stale-draft, media, owner and AI controls remain tested.

Use `npm run format:js` for owned modules. Keep the 40,000-byte module limit and existing classic-helper budgets. Split by responsibility when a module outgrows its owner; do not raise a budget to hide growth. New CSS belongs with its shared component or feature, uses theme tokens and removes replaced selectors. The old override cascade has been deleted.

Deployment checks validate source and preview builds. Production data deletion, a real paid lookup, hosted disaster recovery and account changes require their own explicit scope; fixture evidence is not proof those operations occurred.

## Login protection

`functions/api/login-attempt-limits.js` owns admission to the account password check. Valid login requests reserve an attempt before account lookup or PBKDF2. Normalized emails and the Cloudflare-supplied client IP each allow ten attempts per 15-minute window; sixty total attempts bound guesses that rotate both. All attempts, including successful ones, count. Public registration remains closed, `/api/auth` cannot accept a password, and account reads/sign-out do not consume this budget.

One R2 object, `login-protection/v1.json`, holds the complete bounded window. Email and client identifiers use domain-separated HMAC-SHA256 with the existing server secret; raw emails, IP addresses and passwords are not stored in the counter or logged. Only `CF-Connecting-IP` identifies a client; forwarded headers are ignored, and missing IPs share a conservative fallback. Keep this new current-storage prefix during cleanup.

R2 conditional creation/ETag updates reserve all budgets together across Worker instances. Rejected attempts do not extend the cooldown. Successful sign-ins do not clear concurrent reservations. State expires automatically when the window ends, with an HTTP 429, `Retry-After`, and readable guidance while blocked. The existing sign-in form preserves input and permits cancellation.

Corrupt/oversized state, missing ETags, exhausted bounded retries, storage errors and uncertain write replies return a generic HTTP 503 with a short retry interval before any password check. R2 can also throttle concurrent writes to a single key, so a burst may be refused earlier than the policy threshold. Existing sessions continue to work. This is a deliberately small private-owner control, not a general edge flood-defense service.

The limiter is included by existing whole-site backups and needs no binding, database migration, account reset or dashboard rule. Native local R2 tests cover conditional admission and restart; production cooldowns are not intentionally exercised during release verification.

## Browser security headers

`functions/security-headers.js` owns the application response policy. `scripts/check-security-headers.mjs --write` generates the checked-in root `_headers` file for Cloudflare asset-first responses. `npm run check` refuses drift. Worker-generated pages, API replies, redirects and errors receive the same defaults through a response wrapper; an existing stricter file CSP or framing policy is preserved. The wrapper passes the original stream through, retaining status, cookies, cache validators, content type and download metadata. Async dispatch is awaited so its failures reach the normal protected error response.

The enforced CSP permits first-party scripts plus the existing Cloudflare analytics script/collection hosts. It blocks inline scripts, event-handler attributes, evaluated code, object embeds, base changes, off-site forms and cross-site framing. Inline styles remain permitted for the existing layout/photo tools. First-party, data, blob and HTTPS images remain usable; same-origin frames and blob file flows remain available. X-Frame-Options, nosniff, a cross-origin referrer policy and limited browser permissions complement CSP. Camera use on the same origin and the existing clipboard/file controls are preserved.

Maintained pages use explicit external startup modules (`*-page.js`); keep feature helpers safe to import. Disposable proof startup is external too, entirely under `tests/` and outside production routing/assets. Native local Cloudflare tests exercise the actual `_headers` parser, asset-first/Worker-first routing, conditional revalidation, authenticated cookies, image bytes and document downloads. Browser tests verify normal startup, blocked injected scripts and cross-origin framing, including an isolated control response without framing headers. Full browser workflows cover photos, annotations, clipboard uploads, calculators, sign-in and export/recovery under the enforced policy.

## Save and upload recovery

`assets/request-result.js` owns shared response/error classification, without automatic writes or replay IDs. Successful uploads must confirm the requested ID; Projects writes must return a revision, and lesson saves a record/revision. Unreadable successes remain uncertain. Existing owner checks and API contracts remain server-owned.

`project-client.js` coalesces identical in-flight commands and retains exact IDs through transport failure and failed refresh. Explicit `acknowledge(projectId)` releases only confirmed, settled command bodies after the calling editor/action consumes a successful refresh. It retains uncertain commands, commands for other projects, and weakly held upload jobs. Server receipts and history are never pruned here.

Workshop family/product editors retain a confirmed-save checkpoint until the list refresh succeeds; unchanged retry refreshes only, and edited retry uses the returned revision. Workshop photo queues retain File objects/IDs until confirmation and retry list refresh separately from upload. Lesson queues retain remaining File objects/IDs in the current tab (not durable across reload); confirmed partial uploads are added to the draft once and a final-save retry uploads no bytes again. Before-unload guards include pending photo batches. Load saved lesson explicitly discards the local pending queue with the existing confirmation. Lesson thumbnails use protected server photo URLs; `media-upload-feedback.js` owns temporary object URLs and releases them at completion/error.

Failure-injection browser workflows cover lost committed replies, malformed successful JSON, partial batch failure, final-save reply loss, pending-selection replacement, reload persistence, and draft preservation. These run only against disposable storage.

## CAD links

`cad-link-model.js` owns bounded Dropbox shared-link validation (20 links per scope, file/folder kind, names, stable IDs, HTTPS/host/path checks, full query preservation) and the recognized CAD upload filename policy. `project-cad-links.js` uses guarded item edits for part/assembly `fields.cad_links`, and the `cad-links` overview action for project-level `cadLinks`. Every summary has a separate CAD files section, independent of its top assembly. Link edits merge against the current loaded item/overview and preserve unrelated fields; conflicts still require review. Remove link removes metadata only. No schema migration or Dropbox API/binding is needed.

`cad-link-view.js` renders safe external anchors in live and captured configuration views. Existing project capture/export/import retains link metadata through ordinary fields/overview JSON; imported legacy CAD bytes remain readable and recoverable. Dropbox content/permissions/names do not synchronize automatically, and backups contain URLs, not external bytes. To freeze CAD content, keep a separate Dropbox revision copy and link to it.

New recognized CAD filename uploads are refused at project preparation and before first byte storage (including old pending preparations), and at Workshop upload admission. Exact completed legacy byte retries remain replayable; downloads, exports and restores are untouched. Unknown or disguised file types are not content-sniffed as CAD. Existing synthetic recovery fixtures now use inert generic engineering file names rather than the retired CAD upload UI; dedicated CAD tests also prove actual legacy `.step` download and restore compatibility.
