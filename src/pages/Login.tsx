import type { AuthError } from "@supabase/supabase-js";
import { BarChart3, CloudSun, Radio, ToggleRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const PERKS = [
  { icon: ToggleRight, text: "Switch your HTTP Levers from the browser" },
  { icon: Radio, text: "See every HTTP Adapter signal as it happens" },
  { icon: BarChart3, text: "Track numbers like population or free beds" },
  { icon: CloudSun, text: "Know whether it's temperate, a drought or a badtide" },
];

type Mode = "sign-in" | "sign-up";

const COPY = {
  "sign-in": {
    title: "Sign in",
    intro: "Use the email address and password you signed up with.",
    submit: "Sign in",
    busy: "Signing in…",
    switchPrompt: "New here?",
    switchAction: "Create an account",
  },
  "sign-up": {
    title: "Create an account",
    intro: `Pick a password with at least ${MIN_PASSWORD_LENGTH} characters. You'll be signed in straight away.`,
    submit: "Create account",
    busy: "Creating account…",
    switchPrompt: "Already have an account?",
    switchAction: "Sign in",
  },
} as const;

function explain(error: AuthError, mode: Mode) {
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password don't match.";
    case "user_already_exists":
    case "email_exists":
      return "There's already an account for that email. Sign in instead.";
    case "weak_password":
      return `That password is too easy to guess. Use at least ${MIN_PASSWORD_LENGTH} characters and mix in numbers or symbols.`;
    case "over_request_rate_limit":
      return "Too many attempts. Wait a few minutes and try again.";
    case "signup_disabled":
      return "New accounts are switched off at the moment.";
    default:
      return mode === "sign-in" ? `We couldn't sign you in: ${error.message}` : `We couldn't create your account: ${error.message}`;
  }
}

export function Login() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (session) return <Navigate to="/dashboard" replace />;

  const copy = COPY[mode];

  function switchMode() {
    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
    setError(undefined);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const credentials = { email: email.trim(), password };
    const result =
      mode === "sign-in" ? await supabase.auth.signInWithPassword(credentials) : await supabase.auth.signUp(credentials);
    setBusy(false);
    if (result.error) return setError(explain(result.error, mode));
    // With email confirmation switched on in Supabase, sign-up returns no session until the address is confirmed.
    if (!result.data.session) setError("Your account is waiting for email confirmation. Follow the link we sent, then sign in.");
    // On success, onAuthStateChange sets the session and the redirect above takes over.
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="flex flex-col bg-pine p-6 text-mist sm:p-10">
        <Logo />
        <ul className="mt-10 hidden max-w-sm space-y-4 sm:block lg:mt-auto">
          {PERKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sage">
              <Icon className="mt-0.5 size-5 shrink-0 text-resin" strokeWidth={1.75} />
              {text}
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex items-center justify-center px-6 py-14 sm:px-10">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{copy.title}</h1>
          <p className="mt-3 leading-relaxed text-ink-soft">{copy.intro}</p>

          <div className="mt-8 space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-paper text-base"
            />
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={mode === "sign-up" ? MIN_PASSWORD_LENGTH : undefined}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-paper text-base"
            />
          </div>

          <Button type="submit" disabled={busy} className="mt-6 h-11 w-full text-base">
            {busy ? copy.busy : copy.submit}
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}

          <p className="mt-5 text-sm text-ink-soft">
            {copy.switchPrompt}{" "}
            <button type="button" onClick={switchMode} className="font-medium text-cobalt-deep underline-offset-4 hover:underline">
              {copy.switchAction}
            </button>
          </p>
          {mode === "sign-in" && (
            <p className="mt-2 text-sm text-ink-soft">
              Forgot your password?{" "}
              <Link to="/contact" className="text-cobalt-deep underline-offset-4 hover:underline">
                Get in touch
              </Link>{" "}
              and we'll reset it.
            </p>
          )}

          <p className="mt-5 text-sm leading-relaxed text-ink-soft">
            By signing in you agree to the{" "}
            <Link to="/terms" className="text-cobalt-deep underline-offset-4 hover:underline">terms of use</Link>. The{" "}
            <Link to="/privacy" className="text-cobalt-deep underline-offset-4 hover:underline">privacy policy</Link>{" "}
            explains what we store.
          </p>
        </form>
      </main>
    </div>
  );
}
