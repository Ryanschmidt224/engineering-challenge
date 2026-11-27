> Historical checkpoint. See [current status](../STATUS.md) and the [combined review plan](../WHOLE-SITE-REVIEW-2026-11-27.md). Earlier rollout gates and retired feature instructions do not apply.

# Shared photo-control cleanup — November 26, 2026

Audit finding 25 identified a layout workaround: a lazily imported global ResizeObserver/MutationObserver registry measured every photo and translated its pencil to compensate for toolbar width. It is removed. The shared photo helper now places the pencil in the image stage, with expanded tools in a separate row. CSS aligns the pencil below the stage at the right edge. No observer registry, DOM-bound measurement or transform is needed.

Summary galleries retain their image width cap. Their stage bounds use the number of photos already being rendered, so a single capped image does not leave its pencil at the far edge of a wide page. Photo data, ordering, persistence, markup, paste/upload and disclosure behavior are unchanged.

This also fixes part of finding 27: shared photo action buttons are constructed with BSUI.button rather than a legacy class that only looked correct inside its original toolbar. In particular, Done stays styled after current project media moves the editor into its section body. The pencil retains its unfilled silhouette and position below the photo. Obsolete toolbar selectors and a stale overlay comment are removed instead of adding more overrides.

Validation includes all 512 local code checks and targeted browser workflows for Workshop references, legacy parts at desktop/phone widths, project media upload/reorder/caption/removal, legacy assembly/part action disclosure, pasted images and instruction photos. The project media check now requires a nonempty set of pencils and verifies below-image/right-edge geometry, transparent background, no border and no transform at 1600, 390 and 1280 pixels. It also checks one-photo alignment after removal and standard Done-button styling.

This does not claim the whole legacy CSS cascade or all legacy controls have been consolidated. Live legacy reading, export and historical references remain available pending the separately recorded backup and real-use gates. No database, backup, API, access or production-data changes are included.
