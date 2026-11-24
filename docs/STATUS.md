# Building Schmidt — current status

This is the maintained release and next-work index. Update it in each relevant PR; do not add dated handoffs/status documents to `docs/`. Behavior belongs in `HISTORY_REWRITE_PLAN.md`, retained scope in `FEATURE_INVENTORY.md`, shared presentation rules in `UI_STANDARDS.md`, and ownership in `CODEBASE_GUIDE.md`. Historical reviews remain outside current docs; Git retains prior versions.

## Production and current change

| Work | State / reference |
| --- | --- |
| Photo-read reliability | Live, #67; squash `93f45423a3726f976df3044201b181f22f9e5088`. Optional metadata checks cannot break part reads; inherited existence uses R2 head. |
| Project views / searchable Calculators | Live, #68; squash `6c94028166691aadab100e6a515f17ffda0088e8`. Details/List/Tiles only; calculator search/topics/sort retained. |
| Shared presentation and revision disclosures | Live, #69; squash `1269bbda2008df07881e67420c6e8b3ecad580be`, explicitly approved by the owner after Claude approved head `5119a1c806b34c39955f26ea7790d9e1cf1835c6`. All pre/postmerge GitHub checks passed. Production build `fa4ea521-d489-4403-838f-5a901a02cf1f` succeeded; the live title/footer, title-only Calculators and calculator search were verified in-browser. |
| Current follow-up | Removes Workshop part only from new legacy Helpful tools choices. Saved references remain visible/removable; no schema/data migration. Adds item #17, Recent changes disposition and engine performance acceptance. Implementation/check evidence belongs in this PR; not yet a production release. |
| Project engine | Still gated off in production. No production activation, project-data retirement or deletion is performed by these UI changes. |

The #67/#68 combined release passed 268 code checks / 99 browser workflows. #69 passed 268 / 106 and desktop/phone inspection. These are scoped results for their respective commits, not proof of future rebases or queued features. No live user data was changed/lost by these presentation releases.

This follow-up passes 268 code checks and 18 relevant local browser cases (16 shared CSS baselines plus two desktop/phone reference-retention flows). The tests verify Calculator creation, the empty legacy Tool picker, readable saved Tool/part links, removal and persistence, and unchanged component/tree payloads. Full GitHub browser CI is separate; no engine/D1-tool acceptance pass is claimed.

## Next integration sequence

1. Review this narrow Helpful tools follow-up before merging it, per `ENGINEERING_RULES.md` §6.
2. Reconcile and obtain targeted review of foundation #52 against current main; GitHub reports merge conflicts. Do not force an integration just because older foundation checks passed.
3. Review/integrate #52 → #53 → #65 → #66 in order, carrying current UI decisions forward. Broad evaluations are not exact schema/transaction/file-lifetime reviews. No fifth stacked engine feature PR.
4. Complete the queued Work Instructions/records batch, then identity/alternative ownership, then remaining project parity. Use the History plan and inventory rather than inferring completion from styling.
5. Demonstrate complete recovery, report exact legacy-data disposition, and obtain the explicit engine activation/cutover decision. Code integration is not activation.

| Open engine PR | Last verified source head / purpose |
| --- | --- |
| #52 | `4bfdd0a4c963858b51d54511a90a035d1a6cb9c4` — guarded D1 foundation; reconcile main conflicts before review/integration. |
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
