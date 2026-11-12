import type { User } from "@supabase/supabase-js";
import { supabase, type Colony } from "./supabase";

// Data export: everything stored for a colony (or for every colony of an account) as one JSON
// file, built in the browser from what the signed-in player is allowed to read.

/** Supabase returns at most this many rows per request (API max_rows). */
const PAGE_SIZE = 1000;

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error || res.data === null) throw new Error(res.error?.message ?? "no data");
  return res.data;
}

/** Every signal ever recorded for the colony, oldest first. Throws rather than return part of it. */
async function allEvents(colonyId: string) {
  const events: { id: number; adapter_name: string; state: boolean; received_at: string }[] = [];
  let after = 0;
  for (;;) {
    const page = unwrap(
      await supabase
        .from("adapter_events")
        .select("id, adapter_name, state, received_at")
        .eq("colony_id", colonyId)
        .gt("id", after)
        .order("id")
        .limit(PAGE_SIZE),
    );
    events.push(...page);
    if (page.length < PAGE_SIZE) return events;
    after = page[page.length - 1].id;
  }
}

async function colonyData(colony: Colony) {
  const [numberTrackers, weatherTracker, gameClock, adapterStates, signals] = await Promise.all([
    supabase.from("ladders").select("*").eq("colony_id", colony.id).order("created_at").then(unwrap),
    supabase.from("weather_trackers").select("*").eq("colony_id", colony.id).maybeSingle().then((r) => (r.error ? unwrap(r) : r.data)),
    supabase.from("game_clocks").select("*").eq("colony_id", colony.id).maybeSingle().then((r) => (r.error ? unwrap(r) : r.data)),
    supabase.from("adapter_states").select("name, state, updated_at").eq("colony_id", colony.id).order("name").then(unwrap),
    allEvents(colony.id),
  ]);
  return {
    ...colony,
    trackers: { numbers: numberTrackers, weather: weatherTracker, game_clock: gameClock },
    adapter_states: adapterStates,
    signals,
  };
}

const envelope = () => ({ format: "smartbeavers-export", version: 1, exported_at: new Date().toISOString() });

export async function exportColony(colony: Colony) {
  download(`smartbeavers-${slug(colony.name)}-${today()}.json`, { ...envelope(), colonies: [await colonyData(colony)] });
}

export async function exportAccount(user: User) {
  const colonies = unwrap(await supabase.from("colonies").select("*").order("created_at"));
  const data = [];
  // One colony at a time: a long history is many requests already.
  for (const colony of colonies) data.push(await colonyData(colony));
  download(`smartbeavers-account-${today()}.json`, {
    ...envelope(),
    account: { id: user.id, email: user.email ?? null, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at ?? null },
    colonies: data,
  });
}

const today = () => new Date().toISOString().slice(0, 10);
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "colony";

function download(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
