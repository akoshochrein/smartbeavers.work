import { createFileRoute } from "@tanstack/react-router";
import { adminClient, json } from "@/server/supabase";
import { MAX_SNAPSHOT_BYTES, parseSnapshot } from "@/shared/mod";
import { WEBHOOK_TOKEN_PATTERN } from "@/shared/webhook";

// The companion mod posts a colony's readings to /mod/<token>. The token is the colony's own,
// the same one its adapter links carry. The body is described in src/shared/mod.ts.
//
//   204  recorded (also when the colony is over its limit and the request was dropped)
//   400  the body isn't a snapshot this site understands
//   404  the token is malformed or unknown, so the mod can tell the player
//   413  the body is too large
async function record(request: Request) {
  const [, , token] = new URL(request.url).pathname.split("/");
  if (!token || !WEBHOOK_TOKEN_PATTERN.test(token)) return new Response(null, { status: 404 });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_SNAPSHOT_BYTES) return json({ error: "body too large" }, 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_SNAPSHOT_BYTES) return json({ error: "body too large" }, 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "the body must be JSON" }, 400);
  }
  const snapshot = parseSnapshot(body);
  if (!snapshot.ok) return json({ error: snapshot.error }, 400);

  const { data: known, error } = await adminClient().rpc("record_readings", {
    p_token: token,
    p_readings: snapshot.readings,
    // The generated type wants a string, but the function takes null for "not sent".
    p_faction: snapshot.faction as string,
  });
  if (error) {
    console.error("record_readings failed", error);
    return json({ error: "failed to record readings" }, 500);
  }
  if (!known) return new Response(null, { status: 404 });
  return new Response(null, { status: 204 });
}

export const Route = createFileRoute("/mod/$token")({
  server: {
    handlers: {
      POST: ({ request }) => record(request),
      // Nothing to show here: without this the address would render the web app.
      GET: () => new Response(null, { status: 405, headers: { Allow: "POST" } }),
    },
  },
});
