import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Live data arrives over Supabase Realtime, so refetching on every focus adds nothing.
      // Cached data shows at once and is always checked again when a page opens.
      queries: { staleTime: 0, refetchOnWindowFocus: false, retry: 1 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPendingComponent: () => <div className="min-h-dvh bg-mist" aria-busy="true" />,
  });

  // Also wraps the app in a QueryClientProvider.
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
