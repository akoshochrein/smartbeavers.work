import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/app/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { Switch } from "@/components/ui/switch";
import { HANDLE_PATTERN, profileKey, removeAvatar, saveHandle, setProfilePublic, uploadAvatar, useAvatarUrl, useProfile } from "@/lib/profile";

/** Handle and profile picture, on the account page. */
export function ProfileForm({ userId, email }: { userId: string; email: string }) {
  const client = useQueryClient();
  const profile = useProfile(userId);
  const avatarUrl = useAvatarUrl(profile);
  const fileInput = useRef<HTMLInputElement>(null);

  const saved = profile?.handle ?? "";
  const [handle, setHandle] = useState("");
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState<"handle" | "picture" | "public">();
  useEffect(() => setHandle(saved), [saved]);

  if (profile === undefined) return <Skeleton className="h-40 w-full rounded-2xl" />;

  const refresh = () => client.invalidateQueries({ queryKey: profileKey(userId) });
  const trimmed = handle.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (trimmed && !HANDLE_PATTERN.test(trimmed)) {
      return setProblem("Use 3 to 20 letters, numbers, hyphens or underscores, starting with a letter or number.");
    }
    if (!trimmed && profile?.is_public) {
      return setProblem("A public profile needs a handle. Turn off \"Public profile\" first if you want to remove it.");
    }
    setBusy("handle");
    const result = await saveHandle(trimmed || null);
    setBusy(undefined);
    if (result === "taken") return setProblem(`Someone already uses "${trimmed}". Try another.`);
    if (result !== "ok") {
      // The database refuses a few reserved words such as "admin".
      return setProblem(result.error.includes("check") ? "That handle isn't available. Try another." : `Couldn't save: ${result.error}`);
    }
    setProblem(undefined);
    await refresh();
    toast.success(trimmed ? `You're now ${trimmed}` : "Handle removed");
  }

  async function togglePublic(next: boolean) {
    setBusy("public");
    const { error } = await setProfilePublic(userId, next);
    setBusy(undefined);
    if (error) return toast.error(`Couldn't change that: ${error}`);
    await Promise.all([refresh(), client.invalidateQueries({ queryKey: ["colony-ladder"] })]);
    toast.success(next ? "Your profile is public. Your colonies can appear on the ladder." : "Your profile is private again");
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy("picture");
    const { error } = await uploadAvatar(userId, file);
    setBusy(undefined);
    if (fileInput.current) fileInput.current.value = "";
    if (error) return toast.error(`Couldn't save the picture: ${error}`);
    await refresh();
    toast.success("Picture saved");
  }

  async function clearPicture() {
    setBusy("picture");
    const { error } = await removeAvatar(userId);
    setBusy(undefined);
    if (error) return toast.error(`Couldn't remove the picture: ${error}`);
    await refresh();
    toast.success("Picture removed");
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-5">
        <Avatar url={avatarUrl} name={saved || email} className="size-20 text-3xl" />
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy === "picture"} onClick={() => fileInput.current?.click()}>
              {busy === "picture" ? "Saving…" : profile?.avatar_path ? "Change picture" : "Upload a picture"}
            </Button>
            {profile?.avatar_path && (
              <Button type="button" variant="ghost" disabled={busy === "picture"} onClick={clearPicture}>
                Remove
              </Button>
            )}
          </div>
          <p className="mt-2 text-sm text-ink-soft">Cropped to a square and shrunk before it's stored. Only you see it.</p>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Choose a profile picture"
            tabIndex={-1}
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>
      </div>

      <form onSubmit={submit} className="space-y-2">
        <Label htmlFor="handle">Handle</Label>
        <div className="flex max-w-md gap-2">
          <Input
            id="handle"
            value={handle}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="e.g. dam-builder"
            aria-invalid={!!problem}
            aria-describedby="handle-help"
            onChange={(e) => {
              setHandle(e.target.value);
              setProblem(undefined);
            }}
            className="bg-paper"
          />
          <Button type="submit" disabled={busy === "handle" || trimmed === saved}>
            {busy === "handle" ? "Saving…" : "Save"}
          </Button>
        </div>
        <p id="handle-help" role={problem ? "alert" : undefined} className={problem ? "text-sm text-danger" : "text-sm text-ink-soft"}>
          {problem ?? "The name you go by here, shown instead of your email address. Leave it empty to go without."}
        </p>
      </form>

      <div className="max-w-xl rounded-2xl border bg-paper p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <Label htmlFor="public-profile" className="text-base font-semibold">
              Public profile
            </Label>
            <p id="public-profile-help" className="mt-1 text-sm leading-relaxed text-ink-soft">
              Puts your colonies on the{" "}
              <Link to="/ladder" className="text-cobalt-deep underline-offset-4 hover:underline">
                colony ladder
              </Link>
              , a page anyone can open without signing in.
            </p>
          </div>
          <Switch
            id="public-profile"
            aria-describedby="public-profile-help"
            checked={!!profile?.is_public}
            disabled={busy === "public" || (!saved && !profile?.is_public)}
            onCheckedChange={togglePublic}
          />
        </div>
        {!saved && !profile?.is_public && <p className="mt-3 text-sm text-ink">Save a handle first: colonies are listed under it.</p>}
        <div className="mt-4 grid gap-4 border-t pt-4 text-sm leading-relaxed sm:grid-cols-2">
          <div>
            <div className="font-medium">Anyone can see</div>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-ink-soft">
              <li>your handle</li>
              <li>the names and factions of your colonies</li>
              <li>each colony's game date, weather and population, where you track them</li>
              <li>roughly when each colony was last played</li>
            </ul>
          </div>
          <div>
            <div className="font-medium">Stays private</div>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-ink-soft">
              <li>your email address and picture</li>
              <li>your adapter links, signals and history</li>
              <li>every other tracker</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          A colony is listed only while it has sent a signal in the last hour. Switch this off and your colonies leave
          the ladder straight away. Handles and colony names shown in public have to follow the{" "}
          <Link to="/terms" className="text-cobalt-deep underline-offset-4 hover:underline">
            terms of use
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
