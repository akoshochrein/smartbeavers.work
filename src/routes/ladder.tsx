import { createFileRoute, redirect } from "@tanstack/react-router";

// The page moved to /live. Links to the old address still work, query string included.
export const Route = createFileRoute("/ladder")({
  beforeLoad: ({ location }) => {
    throw redirect({ href: `/live${location.searchStr}`, replace: true });
  },
});
