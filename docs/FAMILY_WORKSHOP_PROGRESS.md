# Family Workshop checkpoint

The approved family/product/use replacement is implemented on `workshop/family-catalog`, PR #35. The previous base-form preview in PR #34 and the earlier persistence prototype are superseded. Do not merge those prototypes.

Verified at head `9902587be788f8c7dd5b8f6d790b6a179762668e`:

- 198 Node tests and 22 browser workflows passed in GitHub Actions.
- The Cloudflare branch preview build succeeded (build `d8b9ac47-b1dd-47ee-a27c-d09388e90fc4`). This is a preview result, not production verification.
- Actual-handler browser QA verified generic and product-backed uses opening their project workspace and displaying separate requirements/product specifications. No live data was used in those fixtures.
- Export checksums, multi-chunk bytes and isolated SQLite restore are tested, including corrupt/truncated backup rejection.
- The retired template, Product Builder, inventory and shared/personal Workshop interfaces and mutation handlers are removed. Existing project-only creation and read-only legacy project backup dependencies remain.
- New styling uses shared tokens/components; legacy override files are frozen and CSS specificity escalation is checked in CI.

The owner has approved production deployment. Promotion still requires checks at the exact final head and verification of the real Cloudflare D1 binding and live authentication. Record the production version/outcome on PR #35. Recovery instructions and intentional deferred features are in `docs/WORKSHOP_RELEASE.md`; current architecture is in `ARCHITECTURE.md`.

No live R2 purge has been performed. Existing Workshop data is not migrated; the clean D1 bootstrap contains 33 categories, 60 families and 233 editable definitions, with no products/uses. Before any future purge, enumerate scope and verify an independent backup/restore. Never delete D1 or R2 as a code rollback.
