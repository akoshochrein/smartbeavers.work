import { Link, Outlet } from "react-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

export function Layout() {
  const { session } = useAuth();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-bark-200 bg-bark-100">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-bark-900">
            <img src="/favicon.svg" alt="" className="size-7" />
            Smart Beavers
          </Link>
          <div className="ml-auto flex items-center gap-4 text-sm">
            {session ? (
              <>
                <Link to="/dashboard" className="hover:text-river-700">Colonies</Link>
                <button onClick={() => supabase.auth.signOut()} className="text-bark-500 hover:text-bark-900">
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" className="rounded-md bg-bark-700 px-3 py-1.5 text-bark-50 hover:bg-bark-900">
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="py-6 text-center text-xs text-bark-500">
        Fan-made tool. Not affiliated with Mechanistry.
      </footer>
    </div>
  );
}
