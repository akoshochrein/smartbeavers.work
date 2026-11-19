import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

// Headers added to everything the server answers itself (pages and server routes).
const SECURITY_HEADERS = {
  // Signed-in pages show adapter links and account controls: never allow the site inside a frame.
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
};

/**
 * A public colony's page, /live/<handle>/<colony>. Search engines are asked to leave these out:
 * agreeing to "anyone browsing the site" is not agreeing to turn up in search results for good.
 * Sent as a header because the page itself renders in the browser, after a crawler has the HTML.
 */
const PUBLIC_COLONY_PATH = /^\/live\/[^/]+\/[^/]+\/?$/;

export default createServerEntry({
  async fetch(request, opts) {
    const response = await handler.fetch(request, opts);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
    if (PUBLIC_COLONY_PATH.test(new URL(request.url).pathname)) headers.set("X-Robots-Tag", "noindex");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
});
