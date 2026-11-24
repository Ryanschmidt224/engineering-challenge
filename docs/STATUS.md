# Building Schmidt — current status

This is the maintained release and next-work index. Update it in each relevant PR; do not add dated handoffs/status documents to `docs/`. Behavior belongs in `HISTORY_REWRITE_PLAN.md`, retained scope in `FEATURE_INVENTORY.md`, shared presentation rules in `UI_STANDARDS.md`, and ownership in `CODEBASE_GUIDE.md`. Historical reviews remain outside current docs; Git retains prior versions.

## Production and current change

| Work | State / reference |
| --- | --- |
| Photo-read reliability | Live, #67; squash `93f45423a3726f976df3044201b181f22f9e5088`. Optional metadata checks cannot break part reads; inherited existence uses R2 head. |
| Project views / searchable Calculators | Live, #68; squash `6c94028166691aadab100e6a515f17ffda0088e8`. Details/List/Tiles only; calculator search/topics/sort retained. |
| Shared presentation and revision disclosures | Live, #69; squash `1269bbda2008df07881e67420c6e8b3ecad580be`, explicitly approved by the owner after Claude approved head `5119a1c806b34c39955f26ea7790d9e1cf1835c6`. All pre/postmerge GitHub checks passed. Production build `fa4ea521-d489-4403-838f-5a901a02cf1f` succeeded; the live title/footer, title-only Calculators and calculator search were verified in-browser. |
| Helpful tools / maintained status | #70 merged with owner approval as `a5d9e6cda0b18b077d207261a8afd09a5b7c02ab`; reviewed source `2221e90ff7e78bef6779cebf21030416e993372b`. All premerge checks passed. New references omit Workshop part; saved links remain readable/removable. No schema/data migration. |
| Command foundation | Integrated and deployed with production gated off, #52; merge `33583ec8450858dbc8b77b0aa1ebf9027ec67edc`, source `ed0d59ed3a349855fb3e9da56d30b9a4b69bdd83`. Claude approved the foundation and the owner approved merge/deploy; requested follow-ups are recorded. Production build `1ddb7074-7a05-455d-8a82-6945785068a3` passed. The live proof page returned Not found while the normal Calculators screen loaded. |
| Current custom-part reconciliation | #53 remains unmerged for targeted review. Both legacy project-files and engine attachments are retained under distinct module names; the engine instruction-text class no longer collides with a retired legacy class. Project creation visibly offers prefix/digits, with BB/3 exercised in browser tests. No production activation or applied-migration change. |
| Project engine | Still gated off in production. No production activation, project-data retirement or deletion is performed by these UI changes. |

The #70/#52 integration candidate passes 287 code checks and all 111 browser workflows locally. The command/model/migration sources are unchanged from the reviewed foundation; the config deduplication yields the same parsed values. This is not a fresh live D1/binding proof.

The #67/#68 combined release passed 268 code checks / 99 browser workflows. #69 passed 268 / 106 and desktop/phone inspection. These are scoped results for their respective commits, not proof of future rebases or queued features. No live user data was changed/lost by these presentation releases.

This follow-up passes 268 code checks and 18 relevant local browser cases (16 shared CSS baselines plus two desktop/phone reference-retention flows). The tests verify Calculator creation, the empty legacy Tool picker, readable saved Tool/part links, removal and persistence, and unchanged component/tree payloads. The reviewed #70 head also passed full GitHub browser CI. No engine/D1-tool acceptance pass is claimed.

## Next integration sequence

1. #70 and #52 are merged with all premerge checks green and explicit owner approval. The production build succeeded; normal site entry and the disabled proof gate were checked in the live browser. No production engine activation occurred.
2. Review #53's current main-aligned head. The engine attachment module was renamed to project-engine-files.js, keeping the live legacy API in project-files.js. The engine instruction-text class was renamed at its owner to avoid a retired-class collision. Core command/model/migration sources are unchanged from the custom-flow baseline. Local validation: 300 code checks and all 117 browser workflows; current GitHub check state is in the PR.
3. With #52 integrated, review/integrate #53 → #65 → #66 in order, carrying current UI decisions forward. Broad evaluations are not exact schema/transaction/file-lifetime reviews. No fifth stacked engine feature PR.
4. Complete the queued Work Instructions/records batch, then identity/alternative ownership, then remaining project parity. Use the History plan and inventory rather than inferring completion from styling.
5. Demonstrate complete recovery, report exact legacy-data disposition, and obtain the explicit engine activation/cutover decision. Code integration is not activation.

| Engine stack | Reviewed / queued source head and purpose |
| --- | --- |
| #52 | Integrated as `33583ec8450858dbc8b77b0aa1ebf9027ec67edc`; production engine disabled. Historical proof and pending exact-version control-plane acceptance remain distinct. |
| #53 | Current review head is linked in PR #53 metadata; custom-part flow reconciled against main. Historical baseline is `c7108a1adb9bd3aa07677e449ddaece073d6accd`. |
| #65 | `b0a4c8717812ca77ddce92f07a0a24186ee36083` — numbered revision/history alignment. |
| #66 | `faec40ecb9284ed50bf09b095a22107998dc3485` — assemblies, frozen Workshop selections, recovery/acceptance tooling. |

## Controlling decisions and remaining work

- Separate Revisions at the part bottom; parent History → Archive for removed tree membership. One dated, change-labeled chevron per saved revision; no duplicate table or deleted snapshots. Ordinary Save leaves the working level unchanged; historical copies remain fixed.
- Archive does not advance revision. Numbers remain consumed across different zero padding; restore retains identities, number and revision.
- Recent changes stays legacy-only until cutover. Do not port automatic per-save snapshots/timeline as engine History or promise full-part undo.
- Helpful tools item #17: Calculator plus D1 Workshop Tool references; last-known names/archived labels; no BOM/cost/tree effect; full recovery. Legacy part references are listed per project in disposition, not guessed into D1 links.
- Review correction: the present legacy Tool catalog has no tool-kind entries, so it offers no new tools. Saved legacy tools still have readable fallback names. This follow-up preserves that boundary; the working D1 tool picker belongs to the queued engine work, not an untested claim in the legacy option fix.
- Identity: one canonical project role name, no separate live tree-name field, one adjustable 20-character limit. Grandfather existing/imported longer names and immutable evidence without truncation; project/root names, Workshop names and MPNs are excluded.
- Alternatives ownership is still planned: role vs product facts/notes/files vs fixed evidence; blank manual structures, frozen Workshop copies, guarded selection/comparison/review flags, A → B → A and recovery. The legacy row repair does not implement that model.
- Work Instruction and header/group revisions reuse the common prompt/commit/snapshot mechanisms but have independent sequences and explicit subtree boundaries. Part revisions freeze their instruction context. No automatic milestones.
- Remaining summary/settings/Parts Management/BOM/tools/purchasing/notes/harness/file parity is tracked in the inventory. Smaller summary image and compact/read-only Parts Management are not delivered by shared CSS alone. Project tags are dropped only in the new engine; Calculator topics remain.
- Independent SolidWorks/STL/document revision labels are explicitly deferred. A part at Rev D may link a CAD file at Rev A. Keep exact immutable file identities/bytes and recovery; do not equate part and file revisions.
- Engine part-page performance has a concrete measurement/target in the plan (PERF 01). No current engine performance pass is claimed.

## Foundation review follow-ups

- **Identity batch:** do not add uses of short_name. Remove it from the pure model, UI and new backup contract together with compatible old-backup/historical readers. Migration 1 is already applied; leave its column or change it only in an appended migration. Existing queued preview uses are not a new naming requirement.
- **Project-level History/records:** engine_events.item_id is currently NOT NULL. Plan a new migration with explicit project/item ownership and nullable item_id for project scope, while preserving project isolation, stable IDs and dependent foreign keys. Review a D1-compatible table/reference rebuild and restore coverage. Never fabricate an engine item to stand for the project.
- **Project creation numbering:** show editable prefix and minimum digits rather than silently accepting NR/4. #53 already exposes both; verify a BB/3 or TB/3 project and first part number. Preserve existing project formats; the database default is not a migration instruction.
- **Preview variables:** Cloudflare documents that preview vars are not inherited from production. #52's normalized config has only NEW_PROJECT_ENGINE=1 in preview vars; AI_LOOKUP_ENABLED is absent. A duplicate earlier vars key was removed without changing that normalized object. The live deployed value is unverified until an actual version-binding check; do not infer it from a disabled/failed AI request or enable paid calls as a diagnostic. Later branches must be inspected separately for explicit overrides.
- **Exact-head acceptance:** retain historical receipts as pinned evidence. The #66 runner is implemented locally but its actual control-plane run is pending integration, deployed version metadata and owner-provisioned read-only runner access. PREVIEW_OWNER_SETUP.md gives minimum permissions and the GitHub secret destination. The current runner reads Workers version bindings, including D1 IDs, and does not call the D1 API, so extra D1 permissions are not required. Secret creation does not activate production or prove recovery.

## Preview and recovery boundaries

| Purpose | Location / resource |
| --- | --- |
| Original custom-part source proof | `https://feature-project-history-alignment-engineering-challenge.ryanschmidt224.workers.dev/project-engine-proof` |
| Assembly proof | `https://feature-project-assemblies-workshop-engineering-challenge.ryanschmidt224.workers.dev/project-engine-proof` |
| Independent restore proof | `https://preview-project-restore-proof-engineering-challenge.ryanschmidt224.workers.dev/project-engine-proof` |
| Source / restore D1 | `building-schmidt-workshop-preview` / `building-schmidt-project-restore-preview`, respectively. Confirm actual isolated bindings before writes. |
| Preview R2 | `building-schmidt-photos-preview`; restored files have independent keys. |

Manual source/independent-restore/source-unchanged checks passed for custom-part and assembly fixtures. The custom backup SHA-256 is `2815b36f8a932cead97ac7077b3cb01f26fc8725f83b91ef795818d3539e23ca`; assembly backup SHA-256 is `abd604e7cc61d7ae581faf769ffee38a8e70b0dc47cfa835178af5cec3196163`. These are historical pinned receipts, not automatic attestation of today's runtime/bindings. Complete receipts are on #66 under `docs/proofs/`, not yet necessarily on main.

The #66 acceptance runner has local Worker/SQL/R2 coverage. Its actual Cloudflare control-plane run remains unperformed until a trusted runner has the read-only secret. Never put secrets in docs/logs. Use the backup stream, not report JSON, to restore; run source-unchanged on the original source host. A prior wrong-host source check was followed by a passing original-source check; it is not unresolved evidence of source corruption.

Retain project/Workshop/Knowledge/account data and historical bytes. Before cutover, inventory exactly what is kept/retired and prove restore. Existing test-data-loss tolerance requires an exact report; it does not authorize silent deletion of newer real projects. Permanent purge remains separately reviewed future work.

## Active review-fix checkpoint

The owner accepted judgment calls from Claude's PR #53 review. The selected implementation is design-only configuration identity plus separately captured per-record build/project context. Format-2 snapshots omit occurrence/project state; record creation payloads retain record_context, and revision/file events retain before/after build_context. Existing format-1 snapshots/IDs/fingerprints remain unchanged and readable. The legacy-to-new boundary is explicit, with no applied migration or destructive conversion.

This patch is on PR #53 and must pass fresh CI. The earlier 300 code checks / 117 browser tests describe the reviewed e341f995 baseline, not new local execution. The coding workspace is unavailable; this run uses GitHub source updates and GitHub CI. Check the PR's exact head/results before claiming validation or merging.

Required coverage includes stable configuration IDs across status/quantity/project-name changes, different IDs after design changes, frozen context on retries/record edits, the first legacy build-only revision without duplicate inserts, and mixed-format recovery. Desktop/phone History must show context separately. The design/context patch at caf0a36c7872bc1983a25056a92fb9fffb2faf61 passes all 303 Node checks and 119 browser workflows in GitHub CI. A follow-up on this same PR implements immutable evidence-edit audit, including original context, retained attachments, unique creation mapping and Before edit/After edit History. Fresh CI/review is required for that follow-up. The next follow-up implements named restore-as-copy in the gated API/UI, with stable retry IDs, scoped child identities and unchanged historical JSON; source and copy coexist with independent file keys. It still requires fresh exact-head CI/review. Copy restore also reads back and hashes staged bytes before publication; a corrupt staging object must fail without project admission. Recovery tests share a side-effect-free fixture helper so importing fixtures does not register another test suite. Actual large-restore capacity remains unmeasured and blocks claiming production recovery readiness.

The ongoing unattended batch must checkpoint changes here/in Git, preserve replay-before-conflict ordering, keep the production engine disabled, and avoid a second concurrent writer when the scheduled continuation wakes. No additional billing/paid provider action or credential change is authorized by unattended operation.

## Compatibility checks before #65 reconciliation

Carry the current design/context, evidence-audit and copy-recovery changes into the existing #65/#66 branches; do not replace them with older stacked sources. In #65, exclude the revision counter from format-2 design identity: a deliberate unchanged-design checkpoint may share its before/after configuration ID. Keep the full part snapshot's own revision counter and occurrence context.

The older #65 saved-part capture includes records/configurations/files but not record-creation context/audit events or explicit attachment links. Its reconciliation must freeze the record creation/edit events and their file ownership alongside saved records, without recursively embedding earlier complete part-revision snapshots. Test that later record/context/attachment edits cannot change the saved copy and that all of this survives copy recovery. The older #65 revision table must also be replaced with the current single dated/change-labeled chevron layout and saved count. These are required integration checks, not completed work or new production regressions.

The latest copy-recovery handler closes the input iterator on every exit, including invalid names/manifests before file processing. A stream-cancellation regression covers that rejection path. Current exact-head results remain on the PR; source updates here do not claim new local execution.
