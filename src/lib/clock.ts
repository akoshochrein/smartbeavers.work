import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Database } from "@/shared/database.types";
import { CLOCK_ADAPTER } from "@/shared/clock";
import { keys, unwrap } from "./queries";
import { supabase } from "./supabase";

export type GameClock = Database["public"]["Tables"]["game_clocks"]["Row"];
export type GameDate = Database["public"]["Functions"]["game_date"]["Returns"][number];

/** The colony's game clock settings: undefined while loading, null if it has none. */
export function useGameClock(colonyId: string | undefined) {
  const { data } = useQuery({
    queryKey: keys.gameClock(colonyId ?? ""),
    enabled: !!colonyId,
    queryFn: async () => unwrap(await supabase.from("game_clocks").select("*").eq("colony_id", colonyId!).maybeSingle()),
  });
  return [data] as const;
}

/** Current game date, computed in the database. `version` should change when day or cycle signals arrive. */
export function useGameDate(colonyId: string, enabled: boolean, version: unknown): GameDate | null | undefined {
  const { data } = useQuery({
    queryKey: [...keys.gameDate(colonyId), String(version)],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => unwrap(await supabase.rpc("game_date", { p_colony: colonyId }))?.[0] ?? null,
  });
  return enabled ? data : null;
}

/** Game days between consecutive moments (one count per pair of bounds), counted in the database. */
export function useDayCounts(colonyId: string, bounds: number[] | undefined, version: unknown) {
  const key = bounds?.join(",") ?? "";
  return useQuery({
    queryKey: ["day-counts", colonyId, key, String(version)],
    enabled: !!key,
    // Keep showing the last counts while a new day's signal is being counted, but not another window's.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[2] === key ? prev : undefined),
    queryFn: async () => {
      const iso = key.split(",").map((t) => new Date(Number(t)).toISOString());
      const rows = unwrap(await supabase.rpc("signal_counts", { p_colony: colonyId, p_adapter: CLOCK_ADAPTER, p_bounds: iso }));
      return (rows ?? []).map((r) => r.n);
    },
  }).data;
}

/** Sets the clock like a wall clock: "the game shows this date right now". */
export async function setGameDate(colonyId: string, cycle: number, day: number) {
  return supabase
    .from("game_clocks")
    .upsert({ colony_id: colonyId, anchor_cycle: cycle, anchor_day: day, anchor_at: new Date().toISOString() })
    .select()
    .single();
}

/**
 * When the window of the last `days` game days began: the `days`-th most recent day signal, or
 * `fallback` (the first day signal) if the clock hasn't counted that many yet.
 * undefined while loading, null if the clock has no day signals at all.
 */
export function useGameDayWindowStart(colonyId: string, days: number, fallback: number | undefined, version: unknown) {
  const { data } = useQuery({
    queryKey: ["game-day-window", colonyId, days, fallback ?? null, String(version)],
    enabled: fallback !== undefined,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from("adapter_events")
          .select("received_at")
          .eq("colony_id", colonyId)
          .eq("adapter_name", CLOCK_ADAPTER)
          .eq("state", true)
          .order("received_at", { ascending: false })
          .range(days - 1, days - 1),
      );
      const at = rows?.[0]?.received_at;
      return at ? Date.parse(at) : fallback!;
    },
  });
  return fallback === undefined ? null : data;
}

/**
 * When each of the last `days` game days began (the clock's day signals), oldest first.
 * undefined while loading; empty if the clock hasn't counted a day yet.
 */
export function useGameDayStarts(colonyId: string, days: number, enabled: boolean, version: unknown): number[] | undefined {
  return useQuery({
    queryKey: ["game-day-starts", colonyId, days, String(version)],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from("adapter_events")
          .select("received_at")
          .eq("colony_id", colonyId)
          .eq("adapter_name", CLOCK_ADAPTER)
          .eq("state", true)
          .order("received_at", { ascending: false })
          .limit(days),
      );
      return (rows ?? []).map((r) => Date.parse(r.received_at)).reverse();
    },
  }).data;
}
