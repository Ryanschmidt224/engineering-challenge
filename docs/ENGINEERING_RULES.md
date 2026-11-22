# BuildingSchmidt engineering rules

Status: proposed engineering standards, 2026-11-22. The owner confirmed the review gate for the current CSS batch: leave it ready for Claude review and do not merge or deploy it yet. Remaining proposed checks are not represented as already enforced.

**Goal:** in five years this site is still one clean system, not layers of patches. These rules apply to every change, whoever writes it. They are written so a reviewer can check a change against them instead of against taste.

**Who does what:** ChatGPT writes and ships code. Claude reviews: it reads pull requests, runs the checks and reports findings. The owner decides. One writer per change; reviewers do not push.

`docs/UI_STANDARDS.md` stays the detailed spec for the shared components. This file is the overall rulebook; where they overlap, they must say the same thing.

---

## 1. The principles

1. **One way to do each thing.** One style system, one section component, one button, one dialog, one tooltip system, one way to save data, one way to show save status. If a second way appears, one of them is deleted in the same change.
2. **Replacing means deleting.** A change that replaces a screen, component, file, endpoint or rule removes the old one in the same pull request: code, CSS, tests, routes and docs. "Leave it for now" is how the legacy layers were made.
3. **Fix at the source, never on top.** If something looks or behaves wrong, change the rule or function that causes it. Do not add a later, more specific rule or a wrapper to undo it.
4. **Plain, durable technology.** Standard HTML, CSS and JavaScript ES modules on Cloudflare Workers, D1 and R2. No framework, no bundler, no CSS preprocessor. A new dependency needs a written reason in the PR and the owner's approval.
5. **Small, named pieces.** Code is split by feature area (projects, assembly, part, work instructions, history, photos, files, knowledge, workshop), not by "misc", "polish", "extras" or "v2".
6. **The repository is the memory.** Agents forget between sessions. Rules, intent and the feature list live in `docs/`, and every session reads them before changing code.

---

## 2. Rules for code

### Structure
- New browser code is **ES modules** (`<script type="module">`) with explicit `import`/`export`. No new globals on `window` except the deliberate shared kit (`window.BSUI`) while legacy classic scripts still exist.
- One feature area per folder or file group, for example `assets/part/…`, `assets/history/…`. Shared helpers go in `assets/shared/…`.
- **File size limit:** a new or rebuilt JS file stays under **40 KB**. Larger means split it by responsibility. Legacy files may shrink but never grow (see checks).
- No code runs at file load except imports and declarations. Pages start through one explicit `init`.
- No dead code: no unused functions, no unloaded files, no commented-out blocks, no "legacy" branches kept "just in case". Git is the archive.

### Data
- All writes go through the API with the existing protections: owner session, same-origin check, revision check (409 keeps the user's draft). Do not weaken these for convenience.
- Database changes only through **numbered, append-only migrations** in `functions/api/workshop-migrations.js` (or its successor). Never edit an applied migration.
- **Stable IDs.** Records keep their IDs forever so Knowledge links and History keep working. Archive instead of delete unless the owner asks for a permanent delete.
- Every stored data type is included in the export/backup format, with a restore test.

### Text and safety
- Insert user text with `textContent` / DOM nodes only, never `innerHTML`.
- Never log or display secrets. No passwords, keys or tokens in code, tests or docs.

---

## 3. Rules for styles (CSS)

- **Tokens only.** Colors, spacing, font sizes, radii, control heights and breakpoints come from `assets/theme.css`. No raw hex colors. Raw pixel values only for a documented one-off layout dimension.
- **Breakpoints:** use the documented values in `theme.css` (narrow 640 px, wide 1024 px) as layouts migrate. Native CSS does not allow `var()` in media-query conditions, so use those literal values there; custom properties can expose the same values to JavaScript. Unmigrated layouts retain their existing widths until reviewed.
- **Specificity:** one class per selector where possible, at most three simple parts. **No `!important`. No ID selectors.** No `:is(#launcher, …)` patterns.
- **Ownership:** each CSS file has one owner, either a shared component (`ui-kit.css`, `components.css`) or one page's layout. A page file never restyles a shared component; it asks for a named variant instead.
- **Unused-selector review.** Report classes without an obvious producer. Account for dynamic construction, states and historical rendering before deleting or enforcing a failure. Curated, reviewed retirements can be enforced automatically.
- **Budget:** a rebuilt page loads at most **60 KB** of CSS uncompressed. Workshop and Knowledge load about 20 KB today; the legacy main page loads 572 KB.
- The legacy files (`site.css`, `site-workspaces.css`, `site-controls.css`, `site-polish.css`) are frozen: they may only lose rules, never gain them. When an area is rebuilt, its rules are deleted from them in the same PR. The end state is all four files deleted.

---

## 4. Rules for the interface

- Screens are assembled from the shared kit: section, section actions, button, control, chip, dialog, tooltip/help, list card, status message. Never hand-build another `<details>/<summary>/<h2>/count` or another dialog shell.
- One control height for every button and input on a toolbar row; one section header height; one body padding.
- Vocabulary is consistent across screens. History uses the redesign wording: *Edit details, Revise design, Change selected product, Add record, Remove from build, Restore to build, Retire step*.
- Help text lives in one file (keyed), not scattered string literals.
- Communicate emptiness once: a zero count in a section header needs no redundant “No notes yet” line. Otherwise use one concise guidance line. Errors say what happened and what to do next.

---

## 5. Automated checks (must pass before merge)

Already in place:
- Syntax check of every script, `prettier --check` on CSS, node unit tests, browser workflow tests, CSS screenshot regression at 1440 px and 390 px.
- Frozen legacy CSS (hash baseline); `!important` and project-ID counts may not rise.

To add (proposed, in this order):
1. **Unused CSS report:** report unmatched classes and review them. Fail only on curated retirements or migrated components whose class construction is explicit. The earlier 893-selector / 271-class count is a baseline candidate inventory, not proof of dead code.
2. **No ID selectors or `!important` in any non-legacy CSS file** (zero, not "no increase").
3. **Breakpoint check:** migrated CSS uses the documented literal media-query values from `theme.css`; do not require unsupported `var()` syntax.
4. **JS size check:** fail if a non-legacy JS file exceeds 40 KB, or a legacy JS file grows (hash or size baseline like the CSS one).
5. **Unloaded-file check:** fail if an `assets/*.js` or `*.css` file is not referenced by any page or module. Today `work-tracker.js` and `site-components.js` fail this.
6. **CSS budget per page:** fail if the stylesheets a page loads exceed its budget.
7. **`innerHTML` guard:** fail on `innerHTML` assignments in new modules, except a reviewed allowlist of static templates.

A check is only relaxed by an explicit, reviewed baseline change in the same PR, with the reason in the PR description.

---

## 6. How a change is made

1. **Read first:** this file, `docs/UI_STANDARDS.md`, `docs/FEATURE_INVENTORY.md` and the relevant area code.
2. **One purpose per pull request.** Keep PRs reviewable: a rebuild of one area, one fix or one cleanup. No unrelated drive-by edits.
3. **The PR description states:**
   - what changed and why
   - what was deleted, which should be the replaced code, CSS and tests
   - which `FEATURE_INVENTORY.md` items this touches and their new status
   - any rule exception and why
   - screenshots for visual changes (desktop and phone width)
4. **Review:** the owner asks Claude to review the PR before merging. Findings are labelled:
   - **Must fix:** a bug, data risk, security issue or rule violation; blocks the merge.
   - **Should fix:** a real problem that can follow in the next PR if noted.
   - **Opinion:** a suggestion, the writer's call.
5. **Merge** only with all checks green. Production deploys from `main`.
6. **Update the docs in the same PR** when behaviour, rules or features change. A doc that no longer matches the code is a bug.

---

## 7. The rebuild of the main page

The legacy main page (projects, assembly, part, work instructions, history, photos, files, backups) is rebuilt **area by area on the new system**, the way Workshop and Knowledge were.

- **Order (suggested):** shared dialog and tooltip, then project list and settings, part page, assembly page and feature tree, work instructions and records, History (to the redesign doc), photos and markup, files and drawings, parts management and BOM, backups.
- Each area: build it new → owner uses it on a preview → tick its items in `FEATURE_INVENTORY.md` → switch over → delete the area's legacy JS, CSS and tests in the same PR.
- Work on a preview branch when a switch-over can't be done in one step. Previews use the separate preview database.
- **Done means:** the four legacy CSS files, `site-assembly.js` and the classic-script loader are gone, and every page uses the shared kit.

---

## 8. Documentation hygiene

- `docs/` holds **current** truth: rules, architecture, data model, UI standards, feature inventory, runbooks.
- Dated reviews, progress notes and handoffs are not kept as permanent docs. Fold anything still true into the current docs and delete the rest; Git keeps history. Candidates today: `INFRASTRUCTURE_REVIEW_20261120.md`, `PRELAUNCH_STATUS.md`, `FAMILY_WORKSHOP_PROGRESS.md`, `FUNCTIONAL_PARTS_ROLLBACK.md`, `WORKSHOP_RELEASE.md`.
- `docs/CODEBASE_GUIDE.md` is updated as each area is rebuilt, so it always describes the code as it is.
