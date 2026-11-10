import { Navigate } from "react-router";
import { useAuth } from "../lib/auth";

// supabase-js (detectSessionInUrl) exchanges the ?code= from the magic link automatically;
// this page just waits for the session to land.
export function AuthCallback() {
  const { session, loading } = useAuth();
  const error = new URLSearchParams(window.location.search).get("error_description");

  if (error) return <p className="p-8 text-ember-500">Sign-in failed: {error}</p>;
  if (session) return <Navigate to="/dashboard" replace />;
  return <p className="p-8 text-bark-500">{loading ? "Signing you in…" : "Waiting for session…"}</p>;
}
