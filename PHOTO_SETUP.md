# Project photos: Cloudflare setup

Project pages now have a public photo gallery and administrator-only uploads. The backend uses Cloudflare Pages Functions and R2. **Uploads will not work until the following settings are configured.**

1. In Cloudflare dashboard, open **Storage & databases → R2**. Enable R2 billing if requested, then create a **Standard** bucket named `building-schmidt-photos`.
2. Open **Workers & Pages → engineering-challenge → Settings → Bindings**. Add an **R2 bucket** binding: variable name `PHOTOS`, bucket `building-schmidt-photos`. Add the binding to production (and preview if desired).
3. Under the Pages project's **Settings → Variables and Secrets**, create a **secret** named `PHOTO_ADMIN_TOKEN`. Generate a random value of at least 32 characters; keep it private. Never commit this token to GitHub. Use a password manager to store it.
4. **Redeploy** the Pages project so the Functions receive the binding and secret.
5. On any project page, expand **Manage photos**, enter the token, select a photo edited in the iPad/Android native photo editor, optionally enter a caption, and press **Upload photo**.

Anyone can view the uploaded photos. Only requests with the administrator token can upload or delete. The token is stored in the browser's session storage (for the current tab) and is not included in public HTML or GitHub.

The API uses `GET /api/photos?project=launcher` for listings, `GET /api/photo?id=...` for image delivery, and authenticated `POST /api/photos` and `DELETE /api/photos?id=...`. R2 stores the photo and its caption as object metadata. Future contributor roles and moderation can be added without changing the photo storage system.

Supported types: JPG, PNG, WebP, GIF, HEIC/HEIF (browser display support for HEIC varies). Maximum upload size: 10 MB. Files remain in R2 even when you update or redeploy the website. Do not share the admin token. If it is compromised, replace the Cloudflare secret.

**Current limitations:** no user accounts, no moderation queue, no automatic image resizing, and the gallery currently displays up to 500 photos per project. This is suitable for an initial administrator-only setup, not public contributions.
