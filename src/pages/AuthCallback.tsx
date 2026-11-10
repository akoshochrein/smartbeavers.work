import { Link, Navigate } from "react-router";
import { LogoMark } from "@/components/brand/Logo";
import { useAuth } from "@/lib/auth";

// supabase-js (detectSessionInUrl) exchanges the ?code= from the magic link automatically;
// this page just waits for the session to land.
export function AuthCallback() {
  const { session } = useAuth();
  const error = new URLSearchParams(window.location.search).get("error_description");

  if (session) return <Navigate to="/dashboard" replace />;

  return (
    <div className="grid min-h-dvh place-items-center bg-pine px-6 text-mist">
      <div className="max-w-sm text-center">
        <LogoMark className="mx-auto size-12" />
        {error ? (
          <>
            <h1 className="mt-6 text-3xl font-bold tracking-tight">That link didn't work</h1>
            <p className="mt-3 text-sage">{error}. Sign-in links work once and expire after an hour.</p>
            <Link to="/login" className="mt-6 inline-block font-bold text-resin underline-offset-4 hover:underline">
              Send a new link
            </Link>
          </>
        ) : (
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Signing you in…</h1>
        )}
      </div>
    </div>
  );
}
