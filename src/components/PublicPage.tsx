import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

/** Footer shared by every signed-out page. */
export function SiteFooter() {
  return (
    <footer className="border-t border-ink/10">
      <div className="mx-auto flex max-w-5xl flex-col gap-x-6 gap-y-3 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:flex-wrap sm:items-center sm:px-8">
        <Logo className="text-ink" />
        <nav aria-label="About this site" className="flex flex-wrap gap-x-5 gap-y-2">
          {[
            ["/contact", "Contact"],
            ["/privacy", "Privacy"],
            ["/terms", "Terms"],
          ].map(([to, label]) => (
            <Link key={to} to={to} className="text-cobalt-deep underline-offset-4 hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <p className="sm:ml-auto">A fan-made tool. Not affiliated with Mechanistry, the studio behind Timberborn.</p>
      </div>
    </footer>
  );
}

/** Header, title and footer for plain reading pages: contact, privacy, terms. */
export function PublicPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  const { session } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col bg-mist">
      <header className="mx-auto flex w-full max-w-5xl items-center px-5 py-5 sm:px-8">
        <Logo />
        <Button asChild variant="outline" className="ml-auto bg-paper">
          <Link to={session ? "/dashboard" : "/login"}>{session ? "Your colonies" : "Sign in"}</Link>
        </Button>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-10 pb-20 sm:px-8 sm:pt-16">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-cobalt-deep hover:underline">
          <ArrowLeft className="size-4" /> Home
        </Link>
        <h1 className="mt-4 text-[2.25rem] leading-[1.1] font-bold tracking-tight sm:text-[2.75rem]">{title}</h1>
        {intro && <div className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">{intro}</div>}
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

/** Long-form text: headed sections with comfortable line length. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="mt-10 max-w-2xl space-y-10 leading-relaxed text-ink-soft [&_a]:text-cobalt-deep [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-ink [&_li]:mt-2 [&_p]:mt-3 [&_strong]:font-bold [&_strong]:text-ink [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      {children}
    </div>
  );
}
