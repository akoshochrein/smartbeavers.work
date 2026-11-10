import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { Button } from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

export function Login() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string>();

  if (session) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 py-12">
      <h1 className="text-2xl font-bold">Sign in</h1>
      {status === "sent" ? (
        <p className="text-bark-700">Check your inbox for a sign-in link.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-bark-200 bg-white px-3 py-2"
          />
          <Button type="submit" disabled={status === "sending"} className="w-full py-2">
            {status === "sending" ? "Sending…" : "Email me a magic link"}
          </Button>
          {error && <p className="text-sm text-ember-500">{error}</p>}
        </form>
      )}
    </div>
  );
}
