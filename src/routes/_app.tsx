import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { RequireAuth } from "@/lib/auth";

// Everything a player sees once signed in. Pathless: adds the shell, not a URL segment.
export const Route = createFileRoute("/_app")({
  component: () => (
    <RequireAuth>
      <AppShell />
    </RequireAuth>
  ),
});
