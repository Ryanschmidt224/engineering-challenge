# Building Schmidt — current status

This is the maintained release and next-work index. Update it in each relevant PR; do not add dated handoffs/status documents to `docs/`. Behavior belongs in `HISTORY_REWRITE_PLAN.md`, retained scope in `FEATURE_INVENTORY.md`, shared presentation rules in `UI_STANDARDS.md`, and ownership in `CODEBASE_GUIDE.md`. Historical reviews remain outside current docs; Git retains prior versions.

## Production and current change

| Work | State / reference |
| --- | --- |
| Photo-read reliability | Live, #67; squash `93f45423a3726f976df3044201b181f22f9e5088`. Optional metadata checks cannot break part reads; inherited existence uses R2 head. |
| Project views / searchable Calculators | Live, #68; squash `6c94028166691aadab100e6a515f17ffda0088e8`. Details/List/Tiles only; calculator search/topics/sort retained. |
| Shared presentation and revision disclosures | Live, #69; squash `1269bbda2008df07881e67420c6e8b3ecad580be`, explicitly approved by the owner after Claude approved head `5119a1c806b34c39955f26ea7790d9e1cf1835c6`. All pre/postmerge GitHub checks passed. Production build `fa4ea521-d489-4403-838f-5a901a02cf1f` succeeded; the live title/footer, title-only Calculators and calculator search were verified in-browser. |
| Helpful tools / maintained status | #70 merged with owner approval as `a5d9e6cda0b18b077d207261a8afd09a5b7c02ab`; reviewed source `2221e90ff7e78bef6779cebf21030416e993372b`. All premerge checks passed. New references omit Workshop part; saved links remain readable/removable. No schema/data migration. |
| Command foundation | #52 approved by Claude at `dbd9f2d74eadb83ed3c9f35ac0b0622c6796a85a` for gated main integration, then authorized by the owner. Follow-ups below are recorded; production activation is not authorized. Main alignment preserves the command/model/migration sources. |
| Project engine | Still gated off in production. No production activation, project-data retirement or deletion is performed by these UI changes. |

The #70/#52 integration candidate passes 287 code checks and all 111 browser workflows locally. The command/model/migration sources are unchanged from the reviewed foundation; the config deduplication yields the same parsed values. This is not a fresh live D1/binding proof.

The #67/#68 combined release passed 268 code checks / 99 browser workflows. #69 passed 268 / 106 and desktop/phone inspection. These are scoped results for their respective commits, not proof of future rebases or queued features. No live user data was changed/lost by these presentation releases.

This follow-up passes 268 code checks and 18 relevant local browser cases (16 shared CSS baselines plus two desktop/phone reference-retention flows). The tests verify Calculator creation, the empty legacy Tool picker, readable saved Tool/part links, removal and persistence, and unchanged component/tree payloads. The reviewed #70 head also passed full GitHub browser CI. No engine/D1-tool acceptance pass is claimed.

## Next integration sequence

1. #70 and #52 targeted reviews and owner merge approvals are complete. Merge #52 only with checks passing, keeping the production engine flag absent. Removal of the duplicate previews.vars key preserves the reviewed effective configuration; it does not enable preview AI or change production AI.
2. Reconcile #53 against the integrated main, preserving current production features. Give the engine attachment module a distinct name from the existing legacy project-files API, and send the resulting head for targeted review. #53's creation form already displays editable prefix and digits; verify explicit project numbering in its browser flow.
3. Review/integrate #52 → #53 → #65 → #66 in order, carrying current UI decisions forward. Broad evaluations are not exact schema/transaction/file-lifetime reviews. No fifth stacked engine feature PR.
4. Complete the queued Work Instructions/records batch, then identity/alternative ownership, then remaining project parity. Use the History plan and inventory rather than inferring completion from styling.
5. Demonstrate complete recovery, report exact legacy-data disposition, and obtain the explicit engine activation/cutover decision. Code integration is not activation.

| Engine stack | Reviewed / queued source head and purpose |
| --- | --- |
| #52 | `dbd9f2d74eadb83ed3c9f35ac0b0622c6796a85a` — guarded D1 foundation, aligned with production #69; targeted review approved; gated integration authorized. Exact deployed-version/control-plane acceptance remains separate from the historical proof. |
| #53 | `c7108a1adb9bd3aa07677e449ddaece073d6accd` — custom-part flow. |
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
