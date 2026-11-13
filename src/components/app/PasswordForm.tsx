import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/** Change the signed-in player's password, on the account page. */
export function PasswordForm({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== repeat) return setProblem("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      return setProblem(
        error.code === "same_password"
          ? "That's already your password. Pick a different one."
          : error.code === "weak_password"
            ? `That password is too easy to guess. Use at least ${MIN_PASSWORD_LENGTH} characters and mix in numbers or symbols.`
            : `Couldn't change your password: ${error.message}`,
      );
    }
    setProblem(undefined);
    setPassword("");
    setRepeat("");
    toast.success("Password changed");
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Password</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">At least {MIN_PASSWORD_LENGTH} characters. You stay signed in here.</p>
      </div>
      {/* Lets password managers file the new password under the right account. */}
      <input type="email" autoComplete="username" value={email} hidden readOnly />
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="repeat-password">Repeat it</Label>
        <Input
          id="repeat-password"
          type="password"
          required
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
      </div>
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={busy}>
        {busy ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
