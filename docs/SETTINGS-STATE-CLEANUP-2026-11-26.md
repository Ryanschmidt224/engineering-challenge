# Settings and navigation cleanup — November 26, 2026

This removes audit workarounds 18 and 24. It does not change saved project data, choice semantics, sign-in, or the engine activation flag.

## Removed workarounds

- A successful settings request formerly remained cached forever in an open page. The client now deduplicates only active reads. Normal navigation reloads choices. A successful settings save sends a same-origin invalidation marker; receiving tabs refresh. Focus/visibility refresh covers unavailable storage notifications and settings changed elsewhere. No setting values or secrets go into local storage.
- Shared navigation formerly downloaded `/api/projects` and inferred application mode from the legacy list's `readOnly` property. It now reads `/api/application-mode`, an explicit boolean response behind the existing private-owner API guard. It does not initialize the project schema or read project rows. Settings is omitted from shared menus when the engine is disabled; existing direct page/API guards are unchanged.

## Reliability boundaries

Existing dialogs keep their field values and available choices while open. Refreshed choices apply to subsequent editors and navigation. A settings read started before a successful save cannot overwrite that save. Failed background refresh leaves the last loaded choices intact; the next navigation retries normally. The Account menu waits for its initial mode response so an early click cannot freeze an incomplete menu. There is no polling loop or background write.

## Validation

512 local Node/code checks passed, including read deduplication, failed-read recovery, save/read ordering, owner/member/signed-out access, both engine modes and absence of project schema initialization. Eight focused browser workflows cover cross-tab save notification, unsaved project-draft preservation, refreshed default owner/tags, engine-on/off shared navigation, desktop/phone menu controls and an intentionally delayed initial mode response. JavaScript size limits stay unchanged; the incremental formatting guard expands to 21 owned modules.

Remaining audit work includes shared archive-rule consolidation, photo layout compensation and frozen legacy controls/CSS. Whole-site export remains consistency checked rather than an atomic D1/R2 snapshot. Removal of live legacy dependencies still depends on the documented real-use and actual nightly-backup verification gates.
