# Disposable Cloudflare restore target

This branch is an infrastructure test target, not a production candidate. It differs from the custom-part preview only by requesting the separate D1 database `building-schmidt-project-restore-preview` in the previews block. The source preview database ID is deliberately absent. Production settings and flag remain unchanged.

Cloudflare documents resource provisioning when a Git-connected deployment declares a D1 binding without an ID. This build checks whether that provisioning is available to the current Preview integration. A successful build is not by itself proof of isolation: the empty project list and the restored project's unchanged source ID must also be verified before the result is accepted. If provisioning is unavailable, stop this target and request a separate preview D1 binding; do not clear or reuse the source database.

The PHOTOS binding intentionally stays on the existing private preview bucket for its owner account. Restore writes independent immutable file objects under its import operation namespace. It does not reuse source file object keys. Production R2 is never bound. No permanent deletion is part of this test.

Reference: https://developers.cloudflare.com/workers/wrangler/configuration/#automatic-provisioning and https://developers.cloudflare.com/workers/previews/resources/ (checked November 22, 2026).
