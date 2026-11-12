import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/shared/database.types";
import { unwrap } from "./queries";
import { supabase } from "./supabase";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const profileKey = (userId: string) => ["profile", userId] as const;

/** Same rule as the database: 3 to 20 letters, digits, underscores or hyphens. */
export const HANDLE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,19}$/;

const AVATAR_BUCKET = "avatars";
/** Pictures are cropped to a square of this many pixels before upload. */
const AVATAR_SIZE = 256;
export const avatarPath = (userId: string) => `${userId}/avatar.webp`;

/** The signed-in player's profile: undefined while loading, null if they haven't set anything yet. */
export function useProfile(userId: string | undefined): Profile | null | undefined {
  return useQuery({
    queryKey: profileKey(userId ?? ""),
    enabled: !!userId,
    queryFn: async () => unwrap(await supabase.from("profiles").select("*").eq("user_id", userId!).maybeSingle()),
  }).data;
}

/**
 * A URL for a stored picture, or undefined if there is none (or it's still loading).
 * The bucket isn't public, so the picture is downloaded through the API and shown from memory.
 * `version` should change when the picture does, e.g. the profile's updated_at.
 */
export function useStoredPicture(path: string | null | undefined, version: string | null | undefined): string | undefined {
  const { data: url } = useQuery({
    queryKey: ["avatar", path ?? "", version ?? ""],
    enabled: !!path,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(AVATAR_BUCKET).download(path!);
      if (error) throw new Error(error.message);
      return URL.createObjectURL(data);
    },
  });
  return path ? url : undefined;
}

/** The signed-in player's own picture. */
export const useAvatarUrl = (profile: Profile | null | undefined) => useStoredPicture(profile?.avatar_path, profile?.updated_at);

/** Sets or clears (null) the handle. Returns "taken" if another player has it. */
export async function saveHandle(handle: string | null): Promise<"ok" | "taken" | { error: string }> {
  // user_id is filled in by the database from the session.
  const { error } = await supabase.from("profiles").upsert({ handle }, { onConflict: "user_id" });
  if (!error) return "ok";
  return error.code === "23505" ? "taken" : { error: error.message };
}

/** Shows or hides the player's colonies on the public ladder. Needs a handle to switch on. */
export async function setProfilePublic(userId: string, isPublic: boolean): Promise<{ error?: string }> {
  const { error } = await supabase.from("profiles").update({ is_public: isPublic }).eq("user_id", userId);
  return error ? { error: error.message } : {};
}

/** Crops the image to a centred square, shrinks it and re-encodes it as WebP. This also drops
 *  anything stored inside the original file, such as where a photo was taken. */
async function toAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  // Browsers that can't write WebP hand back a PNG instead; the bucket only takes WebP.
  if (!blob || blob.type !== "image/webp") throw new Error("This browser can't prepare the picture.");
  return blob;
}

export async function uploadAvatar(userId: string, file: File): Promise<{ error?: string }> {
  let blob: Blob;
  try {
    blob = await toAvatar(file);
  } catch (e) {
    return { error: e instanceof Error && e.message.startsWith("This browser") ? e.message : "That file isn't a picture we can read." };
  }
  const path = avatarPath(userId);
  const upload = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, { upsert: true, contentType: "image/webp", cacheControl: "0" });
  if (upload.error) return { error: upload.error.message };
  // Saving the path again also bumps updated_at, so the new picture replaces the cached one.
  const { error } = await supabase.from("profiles").upsert({ avatar_path: path }, { onConflict: "user_id" });
  return error ? { error: error.message } : {};
}

export async function removeAvatar(userId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("user_id", userId);
  if (error) return { error: error.message };
  const removed = await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(userId)]);
  return removed.error ? { error: removed.error.message } : {};
}

/** The picture as a data: URL, for the data export. Null if there is none. */
export async function avatarDataUrl(profile: Profile | null): Promise<string | null> {
  if (!profile?.avatar_path) return null;
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).download(profile.avatar_path);
  if (error) throw new Error(error.message);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(data);
  });
}
