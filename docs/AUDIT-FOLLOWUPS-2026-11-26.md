# November 26 audit follow-up status

This tracks the 33 findings in `BuildingSchmidt_Workarounds_and_Design_Debt_2026-11-26.md`. A finding is not automatically a defect. “Keep” identifies a deliberate design choice; it does not imply a cleanup was implemented. This document records completion, not authorization to add features or remove historical data.

The owner confirmed that production Projects loads normally after PR #121. That incident was a failed v15 settings migration, not demonstrated project deletion. PR #121 replaces the six-term compound SELECT with the same defaults represented as JSON rows plus one UNION. A workerd D1 regression now covers upgrading v14, retaining an existing project, creating another project, and listing both after a persisted Worker restart.

PR #122 has merged after 470 Node checks, full browser workflows and the Cloudflare preview build passed. Its production build succeeded and deployed Worker version `ffe3b407-83c8-41ae-9f3e-c4a92fe0cd65`. The broader audit is not complete.

| Finding | State | Result or remaining work |
| --- | --- | --- |
| 1. Cross-request initialization promises | Fixed, released #119 | Database initialization no longer shares pending promises across requests. |
| 2. Runtime test coverage and error handling | Partly fixed #121 | Real local D1/workerd upgrade and persistence test now runs in normal checks; explicit migration message/cause logging added. Friendly operation-specific frontend errors and broader runtime coverage remain. |
| 3. Backup verifier accepts invalid archives | Open, high priority | Enforce manifest, record order, counts, verification records and hashes; reject malformed or incomplete input. |
| 4. AI specification conditions/evidence | Open | Preserve source and operating conditions alongside the exact field/value, through save and project copies. |
| 5. Browser fallback uses long backup request | Open, high priority | Use bounded backup transport for supported fallback browsers; do not claim the old stream is reliable. |
| 6. Whole-site recovery rehearsal | Open, high priority | Reconstruct an isolated database/file store and exercise the restored application. Export verification alone is insufficient. |
| 7. Backup reread rather than atomic snapshot | Keep, documented limitation | Retain consistency checks; do not imply a transactionally frozen D1/R2 snapshot. |
| 8. Duplicate exporters and OFFSET paging | Open | Consolidate shared archive rules. Change paging strategy only when measurements justify it. |
| 9. Deployment configuration recovery | Open | Explain that database/files exclude deployment secrets, DNS and account configuration; add an operator recovery checklist. |
| 10. Photo Save closes tools | Fixed, released #122 | Button says Done; photo changes continue to save through their existing actions. |
| 11. Inferred name linkage | Fixed, released #122 | Persist the explicit checkbox in existing fields JSON; server derives the linked name. Equal-but-unlinked text stays unlinked after reload. |
| 12. AI-used identity rules are session-only | Open | Align durable provenance/validation with the owner's request to fill the visible template fields; avoid inventing unrelated requirements. |
| 13. Metadata/document partial save | Open | Make partial completion and retry explicit, or safely stage the upload; retain stable upload identities. |
| 14. Template AI adapts legacy contract | Open | Make requested field IDs, values, evidence and conditions the explicit contract; keep legacy adaptation separate. |
| 15. Strict maker and unit checks | Keep | Do not guess product identity or silently convert incompatible values. |
| 16. Legacy owner column | Keep for compatibility | Do not rebuild a referenced parent table solely to remove a harmless column. Any later removal needs separate migration/backup tests. |
| 17. String owner/tag choices | Keep | Labels do not grant access. Renaming a choice does not silently rewrite projects or history. |
| 18. Settings cache lasts for page lifetime | Open | Invalidate across tabs or on relevant changes without discarding editor drafts. |
| 19. Capped summary JSON/history | Keep, bounded design | Preserve size limits; normalize only if demonstrated requirements exceed the small-application model. |
| 20. Cost label shim and USD assumption | Open limitation | Do not fabricate conversions or silently reinterpret historic prices. Explicit currency/cost modeling requires separate work. |
| 21. Project/top-assembly projection | Keep boundary; cleanup pending | Preserve separate storage identities and centralize repeated presentation rules where needed. |
| 22. Retired storage terminology | Keep compatibility | Remove obsolete UI wording without deleting historical evidence or breaking old backups. |
| 23. Navigation full-state rereads | Measure before changing | Conditional/version reads remain a possible optimization; keep stale-write protection. |
| 24. Legacy API mode detection/routing | Open | Use an explicit application-mode contract and protect Settings routes consistently. |
| 25. JavaScript pencil geometry | Open cleanup | Replace compensation with shared layout rules after verifying photo contexts and responsive behavior. |
| 26. Separate upload-selection implementations | Open | Share selection/drop/paste UI while keeping each owner's persistence and revision rules. |
| 27. Multiple button/UI systems | Open | Consolidate gradually; avoid a wholesale legacy rewrite. |
| 28. CSS growth and overlapping rules | Open | Consolidate owned components while preserving the current appearance. |
| 29. Compressed authored code | Open | Format and split owned modules in reviewable changes, without increasing frozen legacy budgets. |
| 30. Deletion tombstones/sweeps | Keep | They prevent late writes from recreating deleted data; do not remove the fences. |
| 31. Storage-prefix ownership/legacy stop | Keep safety; consolidation pending | Centralize ownership rules and tests without loosening refusal on unexpected references. |
| 32. Paid CPU/logging assumptions | Keep explicit | Retain configured allowances and document actual tested workload; do not claim unlimited capacity. |
| 33. Conflicting status documents | Partly addressed | STATUS and this tracker record the incident and unfinished work. Older handoffs still need a consistent historical/current distinction. |

Next reliability work: findings 3, 5 and 6, then the AI field/evidence contract and upload completion. Backup/recovery or persistent-evidence changes should have a concrete tested candidate before asking the owner about a sensitive-area review. Routine Claude reviews remain disabled.
