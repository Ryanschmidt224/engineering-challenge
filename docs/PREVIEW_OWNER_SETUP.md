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
