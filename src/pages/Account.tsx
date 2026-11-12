import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useColonies } from "@/lib/colonies";
import { supabase } from "@/lib/supabase";
import { ExportButton } from "@/components/app/ExportButton";
import { ProfileForm } from "@/components/app/ProfileForm";
import { exportAccount } from "@/lib/export";

const CONFIRM_WORD = "delete";

export function Account() {
  const { session } = useAuth();
  const { colonies } = useColonies();
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const email = session?.user.email ?? "";
  const count = colonies?.length ?? 0;

  async function remove(e: FormEvent) {
    e.preventDefault();
    if (!session || typed.trim().toLowerCase() !== CONFIRM_WORD) return;
    setDeleting(true);
    let ok = false;
    try {
      const res = await fetch("/api/account", { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
      ok = res.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      setDeleting(false);
      toast.error("Couldn't delete your account. Nothing was removed. Try again in a moment.");
      return;
    }
    // The account is gone on the server; drop the local session without calling it again.
    await supabase.auth.signOut({ scope: "local" });
    toast.success("Your account and its data are deleted");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Account</h1>

      {session && (
        <section className="mt-8">
          <ProfileForm userId={session.user.id} email={email} />
        </section>
      )}

      <section className="mt-10 space-y-4 border-t pt-10">
        <div>
          <div className="text-sm text-ink-soft">Signed in as</div>
          <div className="mt-1 text-lg break-all">{email}</div>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
        <p className="text-sm text-ink-soft">
          Questions about your account or data?{" "}
          <Link to="/contact" className="text-cobalt-deep hover:underline">
            Get in touch
          </Link>
          .
        </p>
      </section>

      <section className="mt-12 flex flex-col gap-4 border-t pt-10 sm:flex-row sm:items-center">
        <div className="max-w-md">
          <h2 className="text-xl font-semibold">Export your data</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            One JSON file with your account details, handle and picture, and every colony: settings, trackers and the full signal history.
            It includes your adapter links, so treat the file as private.
          </p>
        </div>
        {session && <ExportButton run={() => exportAccount(session.user)} className="sm:ml-auto" />}
      </section>

      <section className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="max-w-md">
          <h2 className="text-xl font-semibold">Delete your account</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Removes your account, {count === 1 ? "your colony" : count > 1 ? `your ${count} colonies` : "your colonies"}, their
            trackers and all signal history. This can't be undone.
          </p>
        </div>
        <AlertDialog onOpenChange={(open) => !open && setTyped("")}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="sm:ml-auto">
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <form onSubmit={remove} className="space-y-5">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display text-2xl font-bold tracking-tight">Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Everything stored for {email} is removed for good: colonies, trackers and signal history. Adapters in the
                  game keep calling, but nothing is recorded.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirm-delete">
                  Type <span className="font-mono">{CONFIRM_WORD}</span> to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <Button
                  type="submit"
                  disabled={deleting || typed.trim().toLowerCase() !== CONFIRM_WORD}
                  className="bg-danger text-white hover:bg-danger/90"
                >
                  {deleting ? "Deleting…" : "Delete account"}
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
