# Family Workshop implementation checkpoint

The owner approved implementing and deploying the family/product design, replacing the separate template and inventory systems. The updated design attachment includes 33 categories, 60 starter families and 233 field definitions. No product ratings or stock quantities are seeded.

## Released independently

PR #33 is merged at `f47a4d5342a080c8765f8e3a984a94ce5115d007`. Cloudflare Workers Builds succeeded: production version `abbfd86f-6425-4c6c-ac73-376b759bc05c`, build `87881406-1e59-4843-8e89-fe06194fefef`. Both Node/browser CI jobs passed. This closes public registration, adds the temporary administrator-session API boundary, protects template revisions, and pauses paid AI. This does not configure Cloudflare Access or claim whole-site Access coverage.

## Current branch: work in progress; do not deploy yet

`workshop/family-catalog` replaces the previous preview approach. PR #34 and the incomplete `workshop/persistent-app` branch are superseded; they remain saved to preserve work, not as deployment candidates.

Implemented so far:

- Actual D1/SQLite schema for categories, families, stable field definitions, products, project uses and attachments. Composite foreign keys prevent cross-family product selection. Triggers prevent category cycles and unsafe unit/type changes to populated fields.
- Idempotent clean bootstrap with the approved starter definitions. No old R2 import.
- Administrator/origin guarded catalog CRUD, optimistic revisions, reversible archiving, atomic family field updates, stale family-schema guards and live product-value resolution that preserves project requirements.
- Seven tests pass against a real SQLite database (Node's sqlite module), including foreign keys, JSON functions, transactional rollback and stale batches. Cloudflare binding/provisioning is still unverified.
- Shared CSS geometry tokens, components.css, a layout-only family-workshop.css and the new workshop.html shell. The frontend module is not yet implemented; this checkpoint must not be merged or deployed.

Owner-confirmed behavior: product changes update current project views using that product. Requirements remain separate. Existing instructions, tests and history records are not rewritten. Differences are shown for human review; do not implement automatic engineering compatibility certification. `filled_on_use` is only a display hint; either level can store a value. No inventory or separate template library.

## Next work

1. Finish the family/product/use frontend, category browsing/search, field editing, duplicate family, supplier links and R2 attachments. Maintain one shared renderer and stable field IDs.
2. Wire `/api/workshop`, file/export endpoints and project component projections. Project uses must be authoritative in D1; do not create a second R2 component copy of a use. Replace the old Workshop navigation and selection flow, and remove obsolete UI/template loaders and their obsolete tests.
3. Add upload/export/restore verification and browser tests at desktop/phone widths, including save failure/retry, conflicts, field hiding, product selection later, live product changes, generic resistor and tool/BOM handling.
4. Configure a D1 binding. Current official Wrangler docs support automatic provisioning of D1 bindings without resource IDs, and stable links across deployments; verify the actual Cloudflare build's Wrangler version/permissions before claiming success. The existing Cloudflare Git integration deploys main.
5. Full Node/browser checks, reviewable PR, then deploy under the user's existing explicit production approval. Verify the new production version and live behavior; roll back code if needed while retaining owner API protection.

The CSS cleanup document is incorporated only as a shared foundation for the new screens. Broad legacy CSS consolidation is deferred. Use token-based shared controls, readable CSS, low specificity, meaningful phone layouts and no new !important escalation. Do not use raw CSS line counts as a correctness goal or format retired Workshop overrides.

No live R2 records have been deleted. The owner identifies old Workshop/test data as disposable, but any actual purge still needs an enumerated scope and verified independent backup. Starting a clean D1 catalog does not require deleting old R2 bytes first.
