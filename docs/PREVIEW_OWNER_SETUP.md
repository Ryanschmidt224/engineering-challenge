# Isolated preview owner setup

The private application has no public registration route. A separate R2 preview bucket needs its own owner account; production accounts are not automatically copied there. This is an operator step after the preview's PHOTOS binding and admin_password session-signing secret are configured.

## One-time procedure for an empty preview account store

1. In Cloudflare, confirm the exact bucket is `building-schmidt-photos-preview`, public access is disabled, and neither `users/` nor `user-email/` contains account records. Do not use this procedure to replace an existing account or configure production.
2. Download `scripts/preview-owner-setup.html` and open the saved file in current Chrome or Edge. No local server, extension or installation is required. The file runs locally with network requests blocked by its Content Security Policy. It is excluded from Worker/static assets by `scripts/**` in `.assetsignore`.
3. Choose a new preview password (12–256 characters), save it in the owner's password manager, and generate the files. The fixed test email is `owner@preview.test`. Never send the password or file contents through chat.
4. Download both matching JSON files. In the preview bucket, create/open `users/` and upload the user-record file inside it. At the root create/open `user-email/` and upload the email-index file inside it. The setup file shows the exact resulting R2 keys. Keep the downloaded files private; they contain a salted password hash.
5. Sign in on the fresh branch preview with `owner@preview.test` and the chosen password. Its account handler and owner checks are unchanged. The new runtime secret signs the session; it is separate from the account password.
6. Run the protected project command proof and retain its result with the exact source/deployment version. Do not mark real-D1 validation complete merely because account setup or local tests passed.

## What the helper does

It generates the existing canonical user JSON, with a fresh UUID-based user ID, random salt, PBKDF2/SHA-256 password hash at the existing 100,000 iterations, and fresh session version; it also generates the normal SHA-256 email lookup JSON. It grants the sole synthetic preview owner the existing `admin` role. No raw password is included in either file, no data is sent over the network, no API accepts registration, and no token bypasses authentication. Uploading the files requires the owner's normal Cloudflare bucket-management access.

This utility never connects to a bucket, changes a server secret or alters existing records. Production data, owner account and login stay unchanged. It must not be used as an account recovery/overwrite mechanism. If accounts already exist or an upload would overwrite an object, stop and inspect the existing setup first.

## Verification

Node tests execute the actual self-contained HTML script in an isolated context, upload the generated files into a disposable R2 fixture and log in through the unchanged account API. They verify the admin session, wrong-password rejection, fresh salts/IDs, missing plaintext passwords, disabled network capability and asset exclusion. A browser test opens the actual file:// page and verifies mismatch handling, password clearing and both downloads.

The helper's output is operator-created account data, never committed to Git. The HTML source contains no credentials. Closing the helper without uploading changes nothing; the helper itself deletes nothing.

## Preview environment variables

Cloudflare's [Preview configuration](https://developers.cloudflare.com/workers/previews/configuration/) specifies separate preview vars; production vars are not inherited. In the reviewed foundation configuration, production AI_LOOKUP_ENABLED remains 1, while previews.vars contains NEW_PROJECT_ENGINE=1 and no AI_LOOKUP_ENABLED. The earlier main reconciliation introduced duplicate vars keys; deduplication preserves the effective last-key configuration rather than enabling preview AI. Later branches may explicitly override vars, so inspect their exact config separately.

Do not treat a preview AI error as proof the provider is broken or enable the flag/key to make a test pass. Actual deployed values must be checked read-only in that preview's Variables and secrets settings or its exact version-binding metadata. That live check remains pending; source configuration alone does not attest the deployment. Do not reveal secret values or make paid provider calls for this check.

## Read-only access for the later acceptance runner

The owner creates this token when the #66 runner is integrated and ready. It is a runner credential, not a site login or production runtime secret. No token is needed to keep the production engine disabled.

1. In Cloudflare, go to My Profile → API Tokens → Create Token → Create Custom Token. Name it BuildingSchmidt preview acceptance.
2. Grant **Account → Workers Scripts → Read** only. Scope Account Resources to Include → the specific account hosting engineering-challenge, not all accounts. If supported by the dashboard, a narrower Individual Workers Content Read-Only policy restricted to this Worker is also accepted by the version endpoint. Do not grant Edit/Write, R2, zone/DNS, billing or Global API Key access. Prefer an appropriate expiration; do not restrict to a guessed rotating runner IP.
3. The existing runner calls only GET /accounts/{account}/workers/scripts/engineering-challenge/versions/{version}. That response includes D1 IDs and R2 binding names. It does **not** call the D1 API or execute SQL using this token; therefore **no separate D1 permission is required**. If a future reviewed runner adds D1 metadata calls, revisit that one permission then.
4. Review and create the token. Paste its value directly into GitHub → Ryanschmidt224/engineering-challenge → Settings → Secrets and variables → Actions → Secrets → New repository secret. Name: **CLOUDFLARE_API_TOKEN**. Value: the token. Click Add secret. Never paste it into chat, a PR, repository file, shell argument, screenshot or log. Store any owner's copy only in their password manager.
5. A trusted, reviewed manual acceptance workflow must explicitly pass that secret as the runner environment variable. The current ordinary pull-request checks do not consume it, and adding the secret alone does not run acceptance. Do not expose it to untrusted pull-request/fork code. The owner-session credentials/cookies likewise belong only in the trusted runner's secret store; no authentication bypass is added.
6. After #66 and version metadata are deployed, run the source/independent-target acceptance against isolated preview bindings and retain the secret-free report. Do not report a new live proof merely because the token was added or local tests passed. Rotate/revoke it through Cloudflare when appropriate.

References: [Create a Cloudflare token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/), [Get Worker version and accepted permissions](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/get/), [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets). These steps do not grant access automatically; no secret has been provisioned by this documentation change.
