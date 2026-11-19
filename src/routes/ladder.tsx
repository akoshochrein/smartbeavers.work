import { createFileRoute, redirect } from "@tanstack/react-router";

// The page moved to /live. Links to the old address still work.
export const Route = createFileRoute("/ladder")({
  beforeLoad: () => {
    throw redirect({ to: "/live", replace: true });
  },
});
