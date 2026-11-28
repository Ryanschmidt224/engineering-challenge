// Keep asset-first and Worker-generated responses on the same policy. Regenerate
// the checked-in _headers file with scripts/check-security-headers.mjs --write.
export const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://static.cloudflareinsights.com",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self' https://cloudflareinsights.com",
    "media-src 'self' blob:",
    "frame-src 'self' blob:",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
});

export function secureResponse(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    // File handlers already provide a stricter sandbox CSP. Never replace an
    // explicit response policy with the general application policy.
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function staticHeaderRules() {
  return (
    "# Generated from functions/security-headers.js; do not edit by hand.\n/*\n" +
    Object.entries(SECURITY_HEADERS)
      .map(([name, value]) => "  " + name + ": " + value)
      .join("\n") +
    "\n"
  );
}
