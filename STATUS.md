# BuildingSchmidt implementation status

## Approved direction

Private, single-user engineering application on Cloudflare. The owner chose categories → families → products → project uses, replacing separate templates, Product Builder and inventory. Products are optional; edits update current project displays without overwriting requirements or history. Existing live data is disposable, with verified backup still required before an actual purge. Production deployment is authorized.

## Released security foundation

PR #33 merged at `f47a4d5342a080c8765f8e3a984a94ce5115d007`. Cloudflare production version `abbfd86f-6425-4c6c-ac73-376b759bc05c` built successfully. It closes registration, requires the existing administrator session on application APIs, checks mutation origins and pauses paid AI. It does not configure whole-site Cloudflare Access.

## Family Workshop: PR #35, not deployed yet

The new D1 schema, editable starter catalog (33 categories / 60 families / 233 fields), family/product/use UI, project projections, private uploads and verified streaming exports are implemented. The retired template/Builder/inventory interfaces and mutation handlers are removed. Existing project-only part creation remains available. No live data has been deleted.

198 Node checks pass locally and in the first CI run. The initial browser run exposed one outdated numbering selector and a fixture that created a product after opening a stale catalog form. Those are being corrected; the release remains gated on all browser tests, review and actual Cloudflare D1 provisioning/live checks. See `docs/WORKSHOP_RELEASE.md` for exact limits, backup scope and rollback.

The CSS writeup is applied to the new Workshop foundation: shared geometry/tokens, common controls, minimum touch sizes, phone layouts and CI guardrails. The broad legacy cascade rewrite is deferred. The three existing override files are frozen; new important/project-ID escalation is rejected.

## Deferred, explicitly

Paid AI spending controls; product/use moves across families with reviewed value mapping; a separate pin-list editor; cross-storage assembly archiving of active D1 uses; whole-site Access; independent automatic D1/R2 backup orchestration. Individual Workshop uses and attachments can be reversibly archived now. Project instructions/evidence remain in R2 and require separate project exports alongside the Workshop export.

PR #34 and the earlier persistence prototype are superseded by the approved family design. Do not merge them. No purge of the old Workshop R2 namespaces has been attempted.
