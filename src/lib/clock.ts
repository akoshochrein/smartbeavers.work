import { useEffect, useState } from "react";
import type { Database } from "@/shared/database.types";
import { CLOCK_ADAPTER } from "@/shared/clock";
import { supabase } from "./supabase";

export type GameClock = Database["public"]["Tables"]["game_clocks"]["Row"];
export type GameDate = Database["public"]["Functions"]["game_date"]["Returns"][number];

/** The colony's game clock settings: undefined while loading, null if it has none. */
export function useGameClock(colonyId: string | undefined) {
  const [clock, setClock] = useState<GameClock | null>();
  useEffect(() => {
    if (!colonyId) return;
    supabase
      .from("game_clocks")
      .select("*")
      .eq("colony_id", colonyId)
      .maybeSingle()
      .then(({ data }) => setClock(data));
  }, [colonyId]);
  return [clock, setClock] as const;
}

/** Current game date, computed in the database. `version` should change when day or cycle signals arrive. */
export function useGameDate(colonyId: string, enabled: boolean, version: unknown) {
  const [date, setDate] = useState<GameDate | null>();
  useEffect(() => {
    if (!enabled) {
      setDate(null);
      return;
    }
    let cancelled = false;
    supabase.rpc("game_date", { p_colony: colonyId }).then(({ data }) => !cancelled && setDate(data?.[0] ?? null));
    return () => {
      cancelled = true;
    };
  }, [colonyId, enabled, version]);
  return date;
}

/** Game days between consecutive moments (one count per pair of bounds), counted in the database. */
export function useDayCounts(colonyId: string, bounds: number[] | undefined, version: unknown) {
  const key = bounds?.join(",") ?? "";
  const [counts, setCounts] = useState<{ key: string; n: number[] }>();
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const iso = key.split(",").map((t) => new Date(Number(t)).toISOString());
    supabase
      .rpc("signal_counts", { p_colony: colonyId, p_adapter: CLOCK_ADAPTER, p_bounds: iso })
      .then(({ data }) => !cancelled && setCounts({ key, n: (data ?? []).map((r) => r.n) }));
    return () => {
      cancelled = true;
    };
  }, [colonyId, key, version]);
  return counts && counts.key === key ? counts.n : undefined;
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
 */
export function useGameDayWindowStart(colonyId: string, days: number, fallback: number | undefined, version: unknown) {
  const [t0, setT0] = useState<number | null>();
  useEffect(() => {
    if (fallback === undefined) {
      setT0(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("adapter_events")
      .select("received_at")
      .eq("colony_id", colonyId)
      .eq("adapter_name", CLOCK_ADAPTER)
      .eq("state", true)
      .order("received_at", { ascending: false })
      .range(days - 1, days - 1)
      .then(({ data }) => {
        if (cancelled) return;
        const at = data?.[0]?.received_at;
        setT0(at ? Date.parse(at) : fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [colonyId, days, fallback, version]);
  return t0;
}
