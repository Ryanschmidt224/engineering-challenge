# Personal projects and owner review

The original global administrator login still manages legacy built-in projects. Personal accounts are separate and use signed, HTTP-only, Secure, SameSite=Strict cookies. Password verifiers are salted PBKDF2-SHA256, not plaintext passwords.

## Current behavior

- `/api/accounts`: personal account registration, login, current session, and logout.
- `/api/projects`: public and owned project listing, personal project creation, ownership settings, archive (hide from active catalog without deleting engineering data), and restore.
- New projects have permanent opaque IDs and default to **private**, with owner review enabled.
- The frontend creates project pages from the existing assembly template, initializes the standard tree/BOM/editing controllers, and shows owner-only management actions.
- The owner can publish a project or lock it. Only the owner may directly edit project data; contributors never receive write permissions on the live BOM, tree or instructions.
- `/api/proposals` accepts signed-in users' proposed replacement text for an existing **assembly instruction step** on an accessible unlocked project. Review can accept and apply, or reject. On approval it checks the original text, writes with R2 ETag conflict protection, and records a previous instruction snapshot.
- Raw photos, recipe attachments, tree, BOM, instruction records, drawings, files and part detail APIs use project visibility checks. Do not rely on hiding cards or client-side flags for security.
- Legacy projects remain public and controlled by the existing admin unless explicitly changed.

## What is not implemented yet

1. **Email ownership verification, password reset, credential abuse prevention and rate limits.** Account registration is suitable for controlled internal testing, not an open public sign-up rollout.
2. **Invitations, member roles and collaborative direct editing.** Private projects currently grant access only to their owner (plus the trusted site administrator). Public projects may receive instruction proposals, but contributions to private projects are not yet supported.
3. **Approval of every type of change.** Current proposals modify instruction text fields only; edits to BOM quantities, assets, drawings and tree structure remain owner-only.
4. **A personal/private Workshop library.** Shared Workshop reference material is still site-wide and may only be edited through legacy administrator controls. Do not add private parts to global shared libraries.
5. **Portable download / independent automatic backup of dynamic personal projects.** The existing archive/backup endpoints cover the original hard-coded projects and include global library records; they must not be extended to private projects until shared dependencies are safely excluded.
6. **Local-only/offline personal projects.** Private cloud projects still reside on Cloudflare storage.
7. **Independent security audit and browser deployment smoke tests.** JavaScript syntax checks and mocked backend tests are not a full security assessment.

## Operational rules

- Never publish private source files or engineering artifacts in public endpoints, GitHub commits or shared libraries.
- Never permanently delete a project when its owner chooses Archive. Restoration preserves the same project ID and records.
- A public project made private cannot revoke previously downloaded/cached material.
- The legacy global site administrator retains privileged operational access; privacy is between ordinary users, not from the site operator.
- Before enrolling untrusted public users, enable email verification, abuse controls, real independent backups, and test the deployed Worker and Pages Function authorization routes with separate accounts.

## Primary files

- `functions/api/accounts.js`: personal identity/session authentication
- `functions/api/projects.js`: catalog, owner authorization and privacy
- `functions/api/proposals.js`: suggested instruction changes and owner decisions
- `assets/project-manager.js`: accounts, project creation, archive/restore and owner settings
- `assets/project-review.js`: submit/review interfaces
- `tests/project-ownership.test.mjs`: backend permissions and revision test
- `tests/browser-startup.spec.mjs`: browser project template and owner controls
