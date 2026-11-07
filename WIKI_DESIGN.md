# Collaborative editing design

Building Schmidt uses a Wikipedia-inspired model, adapted to a small engineering reference site.

- Reading requires no account.
- The **Edit** and **History** controls appear only when someone opens an individual topic; no unsolicited prompts.
- Editing an explanation creates a **new immutable revision**, never overwrites an old one.
- Logged-out editors get privacy-preserving temporary identities; never expose IP addresses publicly.
- New or untrusted editors' revisions wait for review; readers see the last approved revision.
- Reviewers can approve, reject, compare, or revert revisions; every action is recorded.
- Trusted registered editors may eventually publish directly, subject to audit and rollback.
- Images require a registered account; existing administrator-only photo uploads remain unchanged until accounts are available.
- A protected page accepts proposed changes but does not permit direct publication by ordinary editors.
- Limit spam with rate limits, content-size limits, and abuse review. Store user-generated text as text, never executable HTML.
- Preserve authorship, timestamps, edit summaries, revision history, and source references.
- Distinguish an unverified hypothesis from a measured engineering result.

## Implementation status
The D1 schema in `migrations/0001_wiki.sql` is a **foundation**, not an activated wiki. The current site still serves static topic explanations, and its local-only drafts are not published edits. Before enabling public editing, configure a D1 database binding, implement authenticated moderation and anonymous sessions, enforce abuse protections, and connect the topic interface to revision APIs. Do not enable unrestricted publishing until those controls are tested.

## Cloudflare infrastructure
R2 stores images; D1 stores topic revisions, editor identities, and review history. Worker routes enforce permissions. Never put admin tokens or secrets in client code.
