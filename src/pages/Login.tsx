import { BarChart3, CloudSun, MailCheck, Radio, ToggleRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const PERKS = [
  { icon: ToggleRight, text: "Switch your HTTP Levers from the browser" },
  { icon: Radio, text: "See every HTTP Adapter signal as it happens" },
  { icon: BarChart3, text: "Track numbers like population or free beds" },
  { icon: CloudSun, text: "Know whether it's temperate, a drought or a badtide" },
];

export function Login() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string>();

  if (session) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(undefined);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(`We couldn't send the link: ${error.message}`);
      setStatus("idle");
    } else {
      setStatus("sent");
    }
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
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait" initial={false}>
            {status === "sent" ? (
              <motion.div key="sent" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <MailCheck className="size-10 text-cobalt" strokeWidth={1.5} />
                <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Check your inbox</h1>
                <p className="mt-3 leading-relaxed text-ink-soft">
                  We sent a sign-in link to <strong className="text-ink">{email}</strong>. Open it on this device to continue.
                </p>
                <Button variant="link" className="mt-4 px-0" onClick={() => setStatus("idle")}>
                  Use a different email
                </Button>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={onSubmit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Sign in</h1>
                <p className="mt-3 leading-relaxed text-ink-soft">
                  We'll email you a link. No password to remember, and new players get an account automatically.
                </p>
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
                <Button type="submit" disabled={status === "sending"} className="mt-4 h-11 w-full text-base">
                  {status === "sending" ? "Sending link…" : "Email me a sign-in link"}
                </Button>
                {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
                <p className="mt-5 text-sm leading-relaxed text-ink-soft">
                  By signing in you agree to the{" "}
                  <Link to="/terms" className="text-cobalt-deep underline-offset-4 hover:underline">terms of use</Link>. The{" "}
                  <Link to="/privacy" className="text-cobalt-deep underline-offset-4 hover:underline">privacy policy</Link>{" "}
                  explains what we store.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
