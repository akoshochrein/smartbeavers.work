import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import appCss from "../index.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { name: "theme-color", content: "#163A33" },
      { name: "description", content: "Use Timberborn's HTTP Lever and HTTP Adapter without writing code." },
      { title: "smartbeavers" },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  notFoundComponent: NotFound,
});

/** The HTML document. Rendered on the server; everything inside it renders in the browser. */
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      </TooltipProvider>
      <Toaster position="bottom-right" richColors={false} />
    </MotionConfig>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-mist px-6">
      <div className="max-w-md">
        <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Page not found</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">There's nothing at this address.</p>
        <Link to="/" className="mt-5 inline-block text-cobalt-deep underline-offset-4 hover:underline">
          Back to the start
        </Link>
      </div>
    </div>
  );
}
