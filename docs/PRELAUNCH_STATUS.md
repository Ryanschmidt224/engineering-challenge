# Building Schmidt — prelaunch audit and work status

Updated: November 14, 2026 (Arizona time)

## Purpose and safeguards

Tracks implementation from the November 2026 requests. **Do not delete production R2 records until an actual production inventory, tested export and recovery copy, and a reviewed deletion manifest exist.** GitHub source changes alone do not verify the live data.

## Implemented in source

- One Projects catalog and one Knowledge Base, shared sidebar navigation and responsive wider layouts
- Optional, nonexclusive project tags (woodworking, CAD, mechanical, electronics, software, PCB design, 3D printing, etc.); filter chips match all selected tags
- Five Workshop categories, recommended specifications separate from personal inventory, assumed consumables excluded from BOM by default
- Per-part multi-supplier references: DigiKey, McMaster-Carr, Mouser, Newark, Arrow, Amazon ASIN, and other ordering references
- DigiKey FastAdd bulk-cart POST from BOM with visible review and no automatic ordering or substitutions
- Regular email/password accounts, administrator user roles, one-time migration of the former administrator credential
- Actionable account-creation validation, duplicate-email feedback, storage/service errors, and structured account-server diagnostics
- Archive export, recovery staging, and scheduled snapshots discover user-created projects from the project catalog instead of relying on a hard-coded list
- Engineering-core read-only project model recognizes user-created project IDs
- New and updated regression test source for the above areas

## Verification still required

1. **Real production Cloudflare account signup:** Confirm `PHOTOS` R2 binding, `admin_password` secret and Worker deployment, because a screenshot still shows legacy 'Request failed' feedback. Confirm the browser is serving the latest version of `project-manager.js`. No test account was created on the live site from this work.
2. **Full regression tests:** The repository already includes `.github/workflows/verify.yml` running `npm run check`. Check the outcome on the latest commit; JavaScript parsing and selected in-memory checks do not establish full CI success.
3. **Visual QA:** Inspect Projects, Knowledge Base, Workshop, Parts Management, part editor, BOM purchase panel, signup dialog at mobile and desktop sizes. Verify there are no initialization errors, clipped controls or inaccessible actions.
4. **Backup recovery:** Export a real newly created project, checksum verify, stage a recovery copy, and verify files independently. Automatic snapshots share the same R2 bucket and are not offsite backups. Verify Cloudflare scheduled backup configuration and Cloudflare logs.
5. **Security/recovery:** Test one-time admin credential claim, multi-account role enforcement, account-recovery path and server-side error handling. Replace legacy shared credential only when an administrator-recovery path exists.
6. **Data-model restructuring:** Part definitions and BOM occurrences are still represented as combined legacy records in live storage. Plan and test a versioned migration before altering the canonical records.
7. **Instruction learning paths:** A first-class reusable Skill model, prerequisites, skill-linked projects and knowledge-article backlinks are **not implemented**. The agreed approach is stable skill IDs, optional project prerequisites and reusable small exercises using the same project editor.
8. **Storage cleanup:** No historical data has been deleted. Review live object inventory and dependencies before removing obsolete sample objects or supporting code.
9. **Purchasing:** DigiKey FastAdd supports a cart handoff, not payment. Other suppliers currently have individual product links/searches, not multi-vendor cart submissions. Users must verify shipping, vendor, product specifications, availability and prices at checkout.

## Remaining implementation order

1. Verify deployed signup and test suite.
2. Verify project backup and recovery with production data and offsite copies.
3. Define and migrate shared part definitions/BOM occurrences with lossless reversible mapping.
4. Add skills, prerequisites and cross-project 'where used' discovery.
5. Reconcile legacy code and historical storage with a reviewed dry-run deletion report.

## Change management

For interrupted requests, preserve the existing objective where possible, incorporate relevant later instructions, and report what was implemented, what was checked, and what remains. Avoid claiming live verification without a production browser test or real CI result.
