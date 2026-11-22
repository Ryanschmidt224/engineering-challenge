# First private-application rollout

This runbook accompanies the containment PR. It is not evidence that production configuration or data has changed.

## Before production

1. Record the current deployed Worker version, source SHA, hostnames, bindings and secrets/configuration names. Verify whether a merge into `main` automatically deploys. Keep the PR unmerged until approval.
2. Confirm that the owner can use the existing administrator account. The containment gate rejects ordinary member accounts, including accounts that previously owned a project. Keep this login until Cloudflare Access and the replacement identity boundary are tested.
3. Configure owner-only Access over the whole Worker or every serving hostname and preview URL. Include static assets, API and downloads. Check R2 has no alternate public serving path.
4. Account for the Static Assets router limitation when implementing Access identity validation. Do not replace the session gate with an unchecked email header or decoded JWT. This PR does not yet implement JWT verification.
5. Run the required checks at the exact proposed source commit. Run staged requests with no session, a member session, and the administrator session. Test direct photo, CAD/PDF, export and AI endpoints, plus mutations with a missing or incorrect Origin.
6. Verify the staging environment uses separate storage and credentials. Synthetic test fixtures must not run against production.

## Expected behavior after this batch

- POST registration returns 410 and does not create records.
- Application API routes require an existing administrator session, including reads of formerly public seed projects and shared Workshop records.
- Authenticated mutations reject missing or foreign browser origins.
- Unknown API paths return JSON 404 rather than a successful HTML app shell.
- Both paid AI endpoints return `AI_PAUSED` without contacting a provider. Do not remove this pause until both paths share a tested global budget.
- Template PUT/DELETE requires the revision the editor opened. Missing/stale revisions return 409, preserving the draft and saved newer template.
- The static frontend still requires Cloudflare Access configuration for whole-site privacy. The API session gate alone is not whole-site privacy.

## Data and clean start

The owner explicitly identifies existing data as placeholders and permits deletion when it simplifies the application. Use this to avoid writing legacy migration code. A new D1 schema may start empty while old R2 content remains untouched until the reset prerequisites are met.

Before an actual reset, enumerate all keys with pagination; identify the exact records/files affected; freeze writers; make an independent byte-and-metadata copy with sizes and SHA-256; restore it into isolated storage and verify the manifest and representative records. Current per-project exports and same-bucket snapshots are not complete independent backups.

Keep account/login data, production secrets, DNS/Access configuration and independent recovery copies outside the content-deletion scope. Do not assume the existing reset script covers newer namespaces or is authorized to delete every unknown prefix. This PR does not execute it or expose it as an API.

Record the reset's exact counts/namespaces in the release notes. Do not reuse placeholder records as a reason to discard future real engineering work.

## Rollback

This batch changes no persistent schema except adding an optional template revision property. It does not delete data or change deployment bindings.

Before deployment, a branch/PR revert is enough. After deployment, keep Cloudflare Access and registration closure in place. If an application regression requires the old Worker, keep the site private and paid AI disabled; do not roll back to publicly reachable member-write behavior. Take a new complete backup before any data-affecting reversal.

An older template writer does not enforce the new editor revision and can remove it. Do not allow mixed old/new writers during rollout or rollback. If necessary, make template editing read-only until the corrected writer is restored. Do not describe a code revert as restoration of records that users edited meanwhile.

If no safe authenticated version is available, keep the application unavailable/private while repairing it. Never reopen registration or remove Access to work around a lockout.
