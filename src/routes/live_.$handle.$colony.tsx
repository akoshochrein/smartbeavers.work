import { createFileRoute } from "@tanstack/react-router";
import { PublicColonyPage } from "@/pages/PublicColony";

// A public colony's page: /live/<handle>/<colony>. Search engines are asked to leave these out,
// here for crawlers that run the page and by a response header in src/server.ts for the rest.
export const Route = createFileRoute("/live_/$handle/$colony")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: PublicColonyPage,
});
