import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

// Headers added to everything the server answers itself (pages and server routes).
const SECURITY_HEADERS = {
  // The colony pages can switch levers in someone's game: never allow them inside a frame.
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
};

export default createServerEntry({
  async fetch(request, opts) {
    const response = await handler.fetch(request, opts);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
});
