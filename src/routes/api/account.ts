import { createFileRoute } from "@tanstack/react-router";
import { adminClient, json } from "@/server/supabase";

// Deletes the signed-in player's account. Removing the auth user cascades to their colonies,
// and from there to trackers, adapter states and signal history. Needs the secret key, so it
// runs on the server rather than in the browser.
export const Route = createFileRoute("/api/account")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
        if (!token) return json({ error: "not signed in" }, 401);

        const supabase = adminClient();

        // Only ever delete the user the token itself proves, never an id from the request.
        const { data, error: authError } = await supabase.auth.getUser(token);
        if (authError || !data.user) return json({ error: "not signed in" }, 401);

        const { error } = await supabase.auth.admin.deleteUser(data.user.id);
        if (error) {
          console.error("deleteUser failed", error);
          return json({ error: "failed to delete account" }, 500);
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
