# Follow-ups

One line per deferred item. This is not permission to expand scope; Batch 5 remains limited to FEATURE_INVENTORY Keep/Rebuild items.

- Owner-reported: the legacy feature-tree pane cannot be scrolled. Restore independent vertical scrolling when its content exceeds the available height; explicitly deferred while switch-over readiness work continues.
- Optional, Claude #76: Knowledge can still link to legacy project targets; this only writes Knowledge data. Hide legacy targets from that picker only if the owner later requests it.
- Optional, Claude #77: if the 60-minute capacity-matrix job times out, run the single capacity profiles; preserve its phase checkpoint instead of increasing the deadline speculatively.
- Operational note, Claude #77: retained synthetic matrix projects add tens of MB to both preview D1s; include them in the owner's separately scoped post-handoff clean-out, with no automatic deletion.
- Optional, Claude #82: rollback means reverting the production engine flag and redeploying. Legacy writes return, but projects created in the engine remain engine-only; do not describe that as a data rollback.

- Claude issue #74: engine photo markup/annotation is deferred; reuse the existing viewer now and preserve original files, without growing the frozen legacy photo-markup module.
- Claude issue #74: current galleries/picture membership are not captured in saved part revisions; removed media rows and original bytes are retained in whole-project backups. Keep this limitation explicit rather than claiming full gallery revision history.

- Post-switch, 5.11: shop-material grouping uses legacy assumedOnHand; the engine has no equivalent saved field. Do not guess by name or mutate schemas in screen-only 5a; picture views follow the reviewed photo role table.
- Required inventory parity, 4.5/4.6/6.12: retain deliberate Milestone/Knowledge draft entry points when their listed area is rebuilt; no automatic entries or new Knowledge system.
- Post-switch only: any individual legacy project migration/Practice-to-Notes conversion is optional later work; keep legacy pages read-only, delete/import nothing for the early switch-over.
- Deferred by owner: independent CAD/STL/file revision labels; keep exact file identities and bytes now, without relabeling files when a part revision advances.
- Deferred cleanup: no new orphan-deletion infrastructure, schedules, tables, triggers or journals; schema-9 recovery/cleanup remains bug-fix-only.
- Measurement-led only: ordinary-save latency and large revision/restore capacity on real D1 remain in the consolidated owner gate; do not optimize rare cleanup races in advance.
- Optional, Claude #71 note: record-order membership guards could match step-order guards; the current project token already protects saves, so leave this outside the UI batch.
- Optional build-tool polish: CSS producer auditing can mistake plain UI captions for class names; refine that distinction without weakening real class checks.
