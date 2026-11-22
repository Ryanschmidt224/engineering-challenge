# BuildingSchmidt private application transition

## Product decisions

- Private engineering application for one owner, hosted on Cloudflare.
- No community registration, contributions, publication workflow, local server product, or desktop application.
- The owner confirmed on November 21, 2026 that current live records are disposable placeholders. Start the replacement data model clean; do not build legacy-data conversion code.
- Before actually deleting live objects, identify the scope and create a verified independent backup. No live deletion has occurred in this batch.
- Redesign one Workshop base form before expanding category templates.
- Keep production architectural changes behind review and approval.

## Implementation branch

`fix/private-app-foundation`, pull request #33. `main` and the live deployment are unchanged by this work.

Completed in separate commits:

1. Repair the 14 failing Node tests, including a selected-part caption bug and stale test expectations. AI specification tests now verify review before applying suggestions.
2. Remove public account creation from the account handler and UI. Synthetic test accounts are provisioned directly in isolated test buckets.
3. Put a central administrator-session gate before every application API route, including direct file/export routes and unknown paths. Check mutation origins centrally.
4. Pause paid AI routes at the Worker boundary until a global budget is implemented. Manual entry remains available.
5. Require expected revisions for template updates/deletes, reject stale editors, and restrict master-template writes to administrators.
6. Pin the browser runner, add a lockfile, syntax-check all JS sources, and consolidate duplicate CI workflows into separate Node/browser jobs.
7. Repair browser fixtures and replace obsolete instruction-content tests with tests for the current container/typed-entry model and failed-save recovery.

The central gate deliberately uses the existing administrator session as temporary containment. It is not the completed Cloudflare Access replacement. Some legacy handlers and community UI remain for later removal; they are no longer publicly reachable through the configured Worker API dispatcher once this batch is deployed.

## Validation

- Local Node suite: 216 passing, 0 failing after the boundary/template changes.
- Syntax validation includes application modules, scripts, browser tests and test helpers.
- New boundary tests exercise unauthenticated reads/writes on every application route, ordinary-account denial, mutation origin rejection, closed signup, and zero provider calls while AI is paused.
- New template tests cover stale saves/deletes, a collection-write race, removal of item values from templates, and member-write rejection.
- Browser workflows run in GitHub Actions against mocked APIs; check the exact PR head before promotion. These tests do not verify Cloudflare Access, production bindings or live R2.
- The sign-in dialog was inspected in a temporary browser preview: owner sign-in remains, public registration controls are absent. The temporary static preview does not provide the live backend.

## Next bounded batches

1. Establish owner-only Cloudflare Access and verify all deployed URLs/bindings; replace the temporary account-based boundary only after this works.
2. Verify an independent complete backup. If a clean reset is needed, clear only the reviewed placeholder scope; preserve credentials and recovery copies.
3. Build and review the simplified Workshop base form using MOSFET, supply, generic resistor, custom bracket and tool fixtures.
4. Start a clean D1 database for new structured records, keeping R2 for immutable files. No migration/import compatibility layer is needed for placeholder application data.
5. Remove old account/community/duplicate Workshop flows in reviewable batches, retaining engineering instructions, tests, revisions, notes and intentional milestones.

See `docs/PRIVATE_CLOUD_ROLLOUT.md` for deployment acceptance and rollback. Older local/offline and community architecture proposals are superseded by these decisions.

## Workshop base preview batch

`workshop/base-form` is stacked on the foundation branch. It adds a working, isolated `workshop-preview.html` and a clean definition/value model for reviewing the base form before persistence or category expansion. It does not replace the old Workshop or write to application APIs. See `docs/WORKSHOP_BASE_REVIEW.md` for the review cases, limitations and rollback.
