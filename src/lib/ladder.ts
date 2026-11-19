import { useQuery } from "@tanstack/react-query";
import { exactValue, latestValue, lowerBound, type Comparison, type Value } from "@/shared/ladders";
import type { Weather } from "@/shared/weather";
import { unwrap } from "./queries";
import { supabase } from "./supabase";

/** One colony in the public list of live colonies. Anything the colony doesn't track is null. */
export type LadderEntry = {
  /** Opaque and stable per colony: follows a row while the order changes. */
  key: string;
  handle: string;
  /** Where the player's picture is stored, and a value that changes when it does. Null if they have none. */
  picture: { path: string; version: string } | null;
  colonyName: string;
  faction: string | null;
  lastSignalAt: number;
  date: { cycle: number; day: number } | null;
  weather: Weather | null;
  /** Game days the current weather has lasted. Null without a game clock running since it started. */
  weatherDays: number | null;
  population: Exclude<Value, { kind: "waiting" }> | null;
};

type PopStep = { threshold: number; state: boolean; updated_at: string };

// The generated types mark every column as present; in fact most can be null.
type Row = {
  key: string;
  handle: string;
  avatar_path: string | null;
  profile_updated_at: string;
  colony_name: string;
  faction: string | null;
  last_signal_at: string;
  cycle: number | null;
  day: number | null;
  weather: Weather | null;
  weather_days: number | null;
  pop_comparison: string | null;
  pop_steps: PopStep[] | null;
  /** The companion mod's exact population, when that is the number to show. */
  pop_reading: number | null;
};

function toEntry(r: Row): LadderEntry {
  const comparison = (r.pop_comparison ?? "gte") as Comparison;
  const pop =
    r.pop_reading != null
      ? exactValue(r.pop_reading, Date.parse(r.last_signal_at))
      : latestValue((r.pop_steps ?? []).map((s) => ({ bound: lowerBound(s.threshold, comparison), state: s.state, at: Date.parse(s.updated_at) })));
  return {
    key: r.key,
    handle: r.handle,
    picture: r.avatar_path ? { path: r.avatar_path, version: r.profile_updated_at } : null,
    colonyName: r.colony_name,
    faction: r.faction,
    lastSignalAt: Date.parse(r.last_signal_at),
    date: r.cycle != null && r.day != null ? { cycle: r.cycle, day: r.day } : null,
    weather: r.weather,
    weatherDays: r.weather_days,
    population: pop.kind === "waiting" ? null : pop,
  };
}

/** A listed colony is live while it has been heard from in the last hour. */
export const LIVE_MS = 60 * 60_000;

/**
 * Colonies of public profiles heard from in the last 7 days, by an adapter signal or the
 * companion mod, most recently heard from first: every live one, and the 20 most recently played
 * of the rest. Checked again every 20 seconds, so nothing on the page goes stale.
 */
export function useColonyLadder() {
  return useQuery({
    queryKey: ["colony-ladder"],
    staleTime: 10_000,
    refetchInterval: 20_000,
    queryFn: async () => {
      const rows = (unwrap(await supabase.rpc("colony_ladder")) ?? []) as unknown as Row[];
      return rows.map(toEntry).sort((a, b) => b.lastSignalAt - a.lastSignalAt);
    },
  });
}
