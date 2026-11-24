# Preview acceptance and review

New project functionality belongs to the project engine. The production legacy pages receive bug fixes only. Keep the production `NEW_PROJECT_ENGINE` flag absent while retained features are incomplete. A disabled engine returns 404 before authentication or migration. Gated integration into main is distinct from production activation.

Review and merge the existing dependency chain in order: #52 (command foundation), #53 (custom-part workflow), #65 (numbered revisions/history alignment), then #66 (assemblies/Workshop selections). Apply targeted Claude review findings before merging each PR. The broad November 23 evaluation is useful architectural feedback, not a substitute for its requested transaction/schema review. Future feature PRs should branch from main after their dependency has been integrated. The Work Instructions/records batch remains queued while the current stack is prepared for that review; no fifth feature PR is added to the chain.

## Automated acceptance

`scripts/preview-acceptance.mjs` runs the same functions as the deployed proof page through normal authenticated APIs. No separate test-account endpoint, auth bypass, direct SQL endpoint or automatic production migration is added. The owner-only, preview-gated `GET /api/project-engine/environment` returns only Cloudflare's runtime version identity and performs no database work.

Before proof writes, the script verifies the actual version's bindings with the read-only Cloudflare control-plane API. It requires source D1 `3314f42f-7c04-4798-99dc-b5b97c4fb82f`, independent target D1 `d761ae08-64f2-4130-8cfa-f596e8e89b80`, R2 `building-schmidt-photos-preview`, and the preview flag on both. A missing runtime identity, Cloudflare authorization error, unexpected binding, common source/target database or unsigned preview access fails before creating proof projects. A response that merely repeats configured binding variables is not accepted as binding verification.

The script checks production's disabled routes, the guarded D1 proof and exact replay, custom-part and assembly/Workshop source proofs, independent recovery, file hashes/keys, and the final byte-for-byte unchanged-source check. Runtime version IDs are rechecked at phase boundaries. It retains synthetic projects and source files for inspection. It never deletes projects, modifies real engineering records, reseeds a database, or changes account/catalog permissions. The assembly proof creates its own clearly named Workshop family and two synthetic products.

Run with Node 22 or later. Provision secrets through a trusted runner's secret store, never command arguments, Git, chat or printed logs:

- `CLOUDFLARE_API_TOKEN`: read-only Workers Scripts Read (or a supported narrower read permission), scoped to the relevant Cloudflare account/Worker.
- `SOURCE_SESSION_COOKIE` and `TARGET_SESSION_COOKIE`: sessions for the existing disposable preview owner, supplied securely by the operator through the trusted runner's secret store. Sign in through the normal preview site, use short-lived sessions for the explicit run, and sign out afterward. Session cookies are sensitive credentials: never paste them into chat, command arguments, files or reports.
- The runner accepts session cookies only. It does not accept owner email/password, perform login, or read password environment variables. Missing either session fails before any network request. The AI does not retrieve or handle the operator's password or browser cookies.

```sh
node scripts/preview-acceptance.mjs \
  --source https://feature-project-assemblies-workshop-engineering-challenge.ryanschmidt224.workers.dev \
  --target https://preview-project-restore-proof-engineering-challenge.ryanschmidt224.workers.dev \
  --account 7b76f55fb2e5395e57f8320ce4b1fd4a \
  --report /absolute/operator-path/preview-acceptance.json
```

This is an explicit operator/CI action; the site never starts it automatically. A report is written only after every check passes. Reports contain runtime IDs, resource IDs and synthetic evidence, never credentials or the raw Cloudflare response. This session validated the script against real local Worker/SQL/R2 handlers with a simulated control-plane response. Running its new control-plane check on Cloudflare still requires the owner's read-only runner secret; existing browser-run platform evidence is not relabeled as a scripted run.

Cloudflare references: [Preview configuration](https://developers.cloudflare.com/workers/previews/configuration/), [Version metadata](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/), [Get Worker version](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/get/).

## Large-recovery capacity gate

Finding F's local regression now exports over 16 MB of metadata / 10,000 rows from 3,000 revised records plus a drawing and verifies every expanded historical revision in a named copy. Migration 6 uses private sealed staging, bounded actual-row loading under a hidden project marker, and a final three-statement publication transaction. Interrupted or mismatched copies stay hidden and exact retries resume. The remaining 100,000-row/256 MB bounds are implementation resource guards, not measured Cloudflare capacity. Keep source and target on compatible migration-6 readers before any platform run; an old reader must not expose a pending copy.

Actual platform measurements remain unperformed. The current acceptance script runs the functional proofs above; it does not implement this capacity benchmark. A separate reviewed operator/CI measurement must record:

1. Exact source commit/runtime version, checked isolated bindings, database plan and configured invocation limits. Use synthetic projects only; retain source and receipts. No production writes or paid provider calls.
2. Elapsed time, D1 statement count/returned execution metadata and complete batch duration for 2,000 / 5,000 / 10,000 representative inserts. Include JSON row sizes and FK/index costs, not empty trivial rows alone. Failed limits are results, not successful proofs.
3. The first revision after a large record import (Finding G), including frozen rows/bytes and its entire guarded batch. That command remains a single batch; do not infer its timing from restore batching.
4. Full streamed export and copy restore of at least 3,000 revised records plus files, including per-batch rows/bytes/time, final row-comparison/publication time, invocation query count and memory evidence. Verify every historical revision, exact files, hidden interrupted copies, same-operation retry and unchanged source.
5. A supported production bound with margin below measured D1/Worker limits, enforced before publication; or a reviewed resumable multi-request design if an invocation cannot safely finish. D1's documented 30-second batch limit is not the only gate. Do not advertise the parser bounds as supported capacity without these results.

Abandoned staging/hidden copies are retained. The pending orphan sweep must also cover uploads, failed Workshop copies and unreferenced frozen values; no deletion/sweep is included in this change. The read-only control-plane token cannot run direct D1 write benchmarks, and this runbook does not authorize granting new secret permissions automatically.

## Evidence

Exact historical reports live under `docs/proofs/`. Moving them does not change their contents, source/build pins, configured-binding evidence or its documented limitations. Current architecture and runbooks link to those reports; evidence is not used as current implementation documentation.

The owner-approved revision model distinguishes the current **working draft** from **fixed historical copies**. Standard Save may alter the working state at its current number; records retain the precise configuration when recorded. Narrative **Change records** do not increment a part revision. Complete part revisions and parent-scoped Archive remain separate actions.

## Current validation

The review corrections passed 315 Node/source/CSS checks and all 113 browser workflows locally. After the final saved-record configuration disclosure and help placement change, all 15 affected project browser workflows passed again. Desktop and phone screenshots were inspected. The scripted run uses the real local Worker and SQL/R2 handlers with only Cloudflare control-plane responses simulated; it is not recorded as a new live control-plane acceptance.
