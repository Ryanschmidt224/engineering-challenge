# Photo ordering and lesson feedback

November 27, 2026. Follow-up to the owner's three additions to the whole-site plan.

## Photo ordering

Dragging a photo or using earlier/later controls immediately shows an indeterminate progress indicator and “Saving photo order…”. Gallery controls are held while that guarded command is pending. The current confirmed order remains visible until the server accepts the change; errors leave it available for retry.

After confirmation, the gallery updates its loaded media rows and moves the existing thumbnail nodes into the accepted order. It updates their numbers, main-photo marker and button positions, then shows photo 1. This removes the previous full-project state/settings refresh and thumbnail reconstruction from ordinary reordering. Existing thumbnails and focus are retained. The measured structural improvement is no extra project-state request after a reorder; no claim is made about a fixed number of seconds on the owner's network.

If the application navigates or replaces the client state during the request, use the normal guarded refresh instead of patching a different view. A failed refresh after a successful write still reports that the order was saved and asks for reload. Lost responses retain the same operation identity; stale revisions remain conflicts. Stored files, gallery membership/history semantics and server command admission are unchanged.

## Lessons Learned

“What happened?” is framed inside the same shared lesson-segment treatment as the steps. It remains the opening description/title field, with the existing autosave and typing/focus behavior.

The idle generic Saved strip is removed entirely, including its empty layout gap. Saving appears beside Done while a request is pending, so typing fields do not jump when feedback appears/disappears. Errors, conflict recovery and Retry saving remain available. Done clears the saving message after confirmation; lesson-photo progress reports saving until attachment metadata is confirmed, then clears. Opening an editor clears stale action feedback.

## Validation

Use desktop and phone browser workflows to hold a reorder response and verify immediate progress, unchanged order while pending, preserved thumbnail nodes and no full-state reread after confirmation. Lose a committed reply and verify exact operation replay; repeat moves to verify current button positions; advance the project in another client and verify the stale reorder leaves the old view intact; reload to verify persistence.

Hold a lesson autosave to verify visible Saving feedback and retained input focus. After confirmation and Done/reopening, verify no idle banner or empty strip. Compare introduction/step frame geometry at phone and desktop widths and inspect screenshots. Retain the existing interrupted-save, concurrent-edit, archive/restore, links and photo workflows. The full code suite, full browser suite and Cloudflare preview must pass on the final candidate; record release evidence on its PR.
