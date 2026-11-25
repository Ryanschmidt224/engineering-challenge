# Early project-engine switch-over

This is the held activation package, not evidence that production is enabled. The owner already approved activation and accepted the 100-placement Archive limit. Complete the remaining platform checks before merging; do not request those decisions again.

## Ready

- Reviewed Work Instructions, History, 5a screens, photos/pictures and daily backups are integrated. New Projects includes the legacy-directory link and Settings backup downloads.
- The reviewed server boundary makes legacy projects read-only when the engine is enabled; the Workshop catalog stays editable. No legacy project is imported, converted, moved or deleted.
- Exact manual source, independent recovery and unchanged-source reports are in `proofs/PROJECT_CUTOVER_ACCEPTANCE.json`, project `8fedb3e8-de11-4f59-b81d-80227372a6a9`, backup hash `d7e132399b3e3adc9636c0952ce2844e1ec630ad3ead6dc77d9ea143a252f8af`.
- Local code/browser suites and the 3,000- and 10,000-record operator rehearsals pass. Local storage and simulated control-plane responses do not establish Cloudflare capacity. The activation candidate itself must pass CI; do not infer local execution while the coding workspace is unavailable.

## Remaining platform run

Run **Measure isolated preview acceptance** on **main** with `capacity-1000` before activation. This runs the binding-verified functional proofs and one 1,000-record workload with complete history and independent recovery. Retain the report in `docs/proofs/`. Larger profiles remain available for later investigation.

The owner supplies these directly to the repository's Actions secret store:

| Secret | Required access |
| --- | --- |
| `CF_PREVIEW_BINDINGS_READ_TOKEN` | Cloudflare Account → Workers Scripts → Read, scoped to account `7b76f55fb2e5395e57f8320ce4b1fd4a`; no write permission |
| `BS_SOURCE_PREVIEW_SESSION` | Existing source-preview owner session, only `bs_user=<value>` |
| `BS_TARGET_PREVIEW_SESSION` | Existing recovery-preview owner session, only `bs_user=<value>` |

Transfer credentials directly from the owner's browser to the trusted secret store. Never use chat, command arguments, files or logs. Codex does not retrieve browser cookies. Remove the two session secrets after the explicit run. This is secure operator access, not another approval request; signing in in regular Chrome does not by itself supply runner access.

| Deployment | D1 | R2 |
| --- | --- | --- |
| `feature-legacy-project-readonly-engineering-challenge.ryanschmidt224.workers.dev` | `building-schmidt-workshop-preview` / `3314f42f-7c04-4798-99dc-b5b97c4fb82f` | `building-schmidt-photos-preview` |
| `preview-project-restore-proof-engineering-challenge.ryanschmidt224.workers.dev` | `building-schmidt-project-restore-preview` / `d761ae08-64f2-4130-8cfa-f596e8e89b80` | `building-schmidt-photos-preview` |

Prepared code pins are source `0fc670b9b7049c8468cb0bb769c2d54046a6f907` and recovery `8c09362abf84ce0ba1302366829be3a55efb9c5f`; only the recovery D1 override differs. These are version-control pins, not independently read runtime/binding evidence.

The runner checks actual runtime-version bindings before proof writes, refuses a common source/target database, checks production remains off, then verifies deployed legacy catalog reads/save rejection/unchanged responses and the engine proof matrix. Retain the non-secret artifact and exact deployment IDs in the existing proof directory.

The 1,000-record pass is the acceptance gate for the initial release. Report the observed request and transfer timings and their limits. Worker CPU, exact D1 execution, cleanup trigger comparisons and larger workloads can be measured later as needed.

## Exact activation

The held PR sets production `vars.NEW_PROJECT_ENGINE` to `"1"` and adds `CF_VERSION_METADATA` so the existing owner-only environment endpoint identifies the deployed version. Preview isolation, production D1/R2, AI settings and daily cron stay unchanged. No application handler, migration, save guard, backup format or restore behavior changes.

After platform readiness, read the latest PR/main heads and checks again. Merge only the tested activation head with an expected-head lease. A moved head or intervening backend change requires fresh assessment. Record the resulting production commit/build/version.

## Deployed verification

1. Confirm production version/bindings and owner access. Keep `building-schmidt-workshop` and `building-schmidt-photos`; anonymous requests remain refused. Do not alter accounts if the owner role/session is missing.
2. Signed-in default home opens new Projects with **Private notebook**. Open a retained legacy project and its read/export path. The harmless invalid legacy-save probe must return `409 LEGACY_READ_ONLY`; compare catalog responses before/after. Never prepare a real legacy edit for this check.
3. Through the normal UI, create a named synthetic engine project, save/reload a part and Work Instruction, add a picture and create a revision. Verify historical copy, standard save and downloaded project export. Retain synthetic data; do not purge it or import real legacy projects.
4. Confirm the deployed cron is `17 9 * * *` (02:17 Phoenix), gated on engine/current schema. At the first scheduled run, check its result and download/verify the project's backup in Settings. Until observed, describe the first production backup run as pending. Backups are append-only in the same R2 bucket, not off-site; unchanged projects are skipped.
5. State observed results and remaining limitations plainly. Explicitly tell the owner when the new system is ready for data they want to keep. Current preview/local results are not that confirmation.

On failure, stop switch-over and preserve every source, engine, backup and historical byte. Turning the engine off also releases its conditional legacy-write boundary; it is not an invisible data rollback. Diagnose the failure before choosing a recovery action. Never purge data to pass a check.

## Owner-facing switch-over list

- Real-Cloudflare timing/acceptance: pending secure execution and assessment of actual platform evidence.
- 100-placement Archive rule: accepted; archive smaller groups for a larger subtree.
- Legacy preservation: reviewed server enforcement is integrated; verify deployed read-only behavior during acceptance. No data has been deleted, overwritten, moved or imported for switch-over.

The proposed project-data clean-out is a separate post-handoff job with exact project/storage/backup scope confirmed then. It does not authorize deleting proof data, Workshop content, accounts or backups now. Remaining Batch 5 groups wait for the owner's requested order.
