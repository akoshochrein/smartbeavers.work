import { createFileRoute } from "@tanstack/react-router";
import { adminClient, json } from "@/server/supabase";
import { MAX_ADAPTER_NAME_LENGTH, WEBHOOK_TOKEN_PATTERN } from "@/shared/webhook";

// Timberborn HTTP Adapters call /hook/<token>/<on|off>/<adapter name> when their input signal
// flips. These URLs are pasted into players' games, so their shape must never change.
// The last part is a catch-all ("$") rather than one segment, so a mangled link still reaches us.
async function record(request: Request) {
  // Read the path ourselves so the adapter name is decoded exactly once ("HTTP%20Adapter%201").
  const [, , token, signal, ...rest] = new URL(request.url).pathname.split("/");
  let name: string;
  try {
    name = decodeURIComponent(rest.join("/"));
  } catch {
    return json({ error: "invalid adapter name" }, 400);
  }

  // A link pasted into a field that already held one arrives doubled:
  // /hook/<token>/on/GameDayhttps://smartbeavers.work/hook/<token>/on/GameDay
  // The game shows only "Status: Error" for that, so take the name from the first copy instead.
  name = name.replace(/https?:\/.*$/s, "");

  const notFound = () => new Response(null, { status: 404 });
  if (!token || !WEBHOOK_TOKEN_PATTERN.test(token)) return notFound();
  if (signal !== "on" && signal !== "off") return notFound();
  if (!name || name.length > MAX_ADAPTER_NAME_LENGTH) return json({ error: "invalid adapter name" }, 400);

  const { data: recorded, error } = await adminClient().rpc("record_adapter_event", {
    p_token: token,
    p_adapter: name,
    p_state: signal === "on",
  });

  if (error) {
    console.error("record_adapter_event failed", error);
    return json({ error: "failed to record event" }, 500);
  }
  if (!recorded) return notFound();
  return new Response(null, { status: 204 });
}

export const Route = createFileRoute("/hook/$token/$signal/$")({
  // The adapter's Method dropdown offers GET and POST, so accept both.
  server: { handlers: { GET: ({ request }) => record(request), POST: ({ request }) => record(request) } },
});
