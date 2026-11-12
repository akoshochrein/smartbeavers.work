import { useQuery } from "@tanstack/react-query";
import { latestValue, lowerBound, type Comparison, type Value } from "@/shared/ladders";
import type { Weather } from "@/shared/weather";
import { unwrap } from "./queries";
import { supabase } from "./supabase";

/** One colony on the public ladder. Anything the colony doesn't track is null. */
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
  /** When the colony's current cycle started (temperate weather began). Null if it doesn't track weather. */
  cycleStartedAt: number | null;
  weather: Weather | null;
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
  cycle_started_at: string | null;
  weather: Weather | null;
  pop_comparison: string | null;
  pop_steps: PopStep[] | null;
};

function toEntry(r: Row): LadderEntry {
  const comparison = (r.pop_comparison ?? "gte") as Comparison;
  const pop = latestValue(
    (r.pop_steps ?? []).map((s) => ({ bound: lowerBound(s.threshold, comparison), state: s.state, at: Date.parse(s.updated_at) })),
  );
  return {
    key: r.key,
    handle: r.handle,
    picture: r.avatar_path ? { path: r.avatar_path, version: r.profile_updated_at } : null,
    colonyName: r.colony_name,
    faction: r.faction,
    lastSignalAt: Date.parse(r.last_signal_at),
    date: r.cycle != null && r.day != null ? { cycle: r.cycle, day: r.day } : null,
    cycleStartedAt: r.cycle_started_at ? Date.parse(r.cycle_started_at) : null,
    weather: r.weather,
    population: pop.kind === "waiting" ? null : pop,
  };
}

/**
 * Colonies of public profiles that sent a signal in the last hour. The colony that most
 * recently started a new cycle (temperate weather began) comes first; colonies that don't
 * track weather follow, most recently active first. Checked again every 20 seconds, so the order shifts as games are played.
 */
export function useColonyLadder() {
  return useQuery({
    queryKey: ["colony-ladder"],
    staleTime: 10_000,
    refetchInterval: 20_000,
    queryFn: async () => {
      const rows = (unwrap(await supabase.rpc("colony_ladder")) ?? []) as unknown as Row[];
      return rows
        .map(toEntry)
        .sort((a, b) => (b.cycleStartedAt ?? 0) - (a.cycleStartedAt ?? 0) || b.lastSignalAt - a.lastSignalAt);
    },
  });
}
