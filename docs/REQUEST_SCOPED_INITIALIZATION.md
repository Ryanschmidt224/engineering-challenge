# Request-scoped database initialization

Nov 26: the owner reported Projects failing with Cloudflare's cross-request promise-resolution error. The engine initializer retained in-flight promises in a module-level WeakMap, and the Workshop initializer retained setup promises even after completion. Those caches predated the Nov 25 changes; the new simultaneous Projects/settings reads added another path that could encounter them. The screenshot establishes the runtime failure, not a complete production trace of which cache supplied the promise.

Each initializer now performs its own readiness/migration check in the current request. Existing atomic migration transactions and version-ledger race handling remain authoritative. No schema version, access rule, project data, backup retention, compatibility date or runtime flag changes. In particular, the fix does not opt out of `handle_cross_request_promise_resolution`.

Four regression cases exercise both initializers: each sequential call performs its own readiness read, and a second request can complete while a first request's readiness read is held. The tests fail against the previous implementation and pass with the fix. Existing migration race/rollback/newer-version cases remain required. Node fixtures do not themselves emulate Cloudflare request lifetime; platform-specific validation is separate from these tests.

Cloudflare reference: https://developers.cloudflare.com/workers/configuration/compatibility-flags/#handle-cross-request-promise-resolution-correctly
