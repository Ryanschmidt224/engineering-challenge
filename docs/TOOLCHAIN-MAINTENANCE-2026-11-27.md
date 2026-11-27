# Development toolchain maintenance

November 27, 2026. Application baseline: #143, merged as `b53f97f8fea15c8874859056bf0dfb44157c9556`.

## Change

Keep the published stable Miniflare API and workerd combination and update only its affected image/network libraries. The public npm registry still identifies `4.20260730.0` as Miniflare's latest stable release. The newer `5.20261127.0-beta` uses Sharp 0.35.5 and Undici 7.30.2 but remains a prerelease. Rather than change simulator major versions during security maintenance, use npm's supported parent/version-scoped overrides for those same libraries.

| Dependency under Miniflare 4.20260730.0 | Previous | Selected |
| --- | --- | --- |
| Sharp | 0.35.2 | 0.35.5 |
| Undici | 7.28.0 | 7.30.2 |

The reviewed Sharp advisory marks versions below 0.35.4 affected. The reviewed Undici advisory marks 7.x below 7.30.1 affected. These selected versions clear those affected ranges. This is a targeted advisory correction, not a claim that a full vulnerability scan found no other issues.

Overrides apply only to `miniflare@4.20260730.0`. Remove them when a supported stable Miniflare release selects patched versions itself, after native migration/recovery and browser checks pass. Do not broaden the overrides globally or downgrade Miniflare through an automatic audit fix.

GitHub CI uses immutable commits for Checkout 7.0.1, Setup Node 7.1.0 and Upload Artifact 7.0.2. These maintained actions use Node 24 internally; the application test jobs retain Node 22. Workflows retain read-only repository permissions and the same code/browser acceptance requirements. No deploy credential or runtime binding changes.

Dependabot checks npm packages and GitHub Actions weekly and opens bounded review PRs. There is no automatic merge. This makes dependency maintenance visible between redesigns.

## Validation and limits

A fresh lockfile/install must show exactly the selected Sharp/Undici versions under stable Miniflare. Run the full code suite, native D1/workerd migrations and restart/recovery tests, browser workflows, and a Worker build. Inspect the installed tree, lockfile and exact-head CI results; record release evidence on the PR. Application Worker bytes must remain identical because this change concerns development tools and CI only.

Automatic approval review rejected `npm audit` because the command sends dependency metadata to the public npm registry. It was not run through another service or environment. Local/CI installs explicitly omit that implicit audit transmission. The previous CI installation printed advisories but did not enforce an audit gate; all actual regression/build checks remain. Full npm vulnerability scanning remains an explicitly recorded verification limit pending the owner's authorization.

## Primary evidence

- [Sharp advisory GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)
- [Undici advisory GHSA-4w7w-5xrc-9h26](https://github.com/nodejs/undici/security/advisories/GHSA-4w7w-5xrc-9h26)
- Public npm metadata for Miniflare 4.20260730.0, Miniflare 5.20261127.0-beta, Sharp 0.35.5 and Undici 7.30.2, checked November 27.
- [npm parent/version-scoped overrides](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#overrides)
- [Checkout 7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [Setup Node 7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), [Upload Artifact 7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)
- [Dependabot configuration](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
