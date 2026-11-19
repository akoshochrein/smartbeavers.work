import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { unwrap } from "./queries";
import { supabase, type AdapterEvent } from "./supabase";
import { HISTORY_DAYS } from "./useColonyFeed";
import type { TrackerHistoryRow } from "@/shared/ladders";

export type HistoryEvent = { adapter_name: string; state: boolean; received_at: string; carried?: boolean };

/** Supabase caps each response at this many rows (API max_rows). */
const PAGE_SIZE = 1000;
/** ~360 points per adapter over the window: finer than a chart a few hundred pixels wide can show. */
export const CHART_BUCKET_SECONDS = Math.round((HISTORY_DAYS * 86_400) / 360);

const historySince = () => new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();

/**
 * History for a few adapters over the last HISTORY_DAYS, shaped by the `adapter_history`
 * database function: their states when the window opened, then the last signal per adapter per
 * `bucketSeconds` (0 = every signal). Live signals for these adapters are appended as they arrive.
 */
export function useAdapterHistory(
  colonyId: string,
  adapters: string[],
  bucketSeconds: number,
  live: AdapterEvent[],
  enabled = true,
  /** Start of the window, if shorter than HISTORY_DAYS (ms since epoch). */
  sinceMs?: number,
) {
  const key = adapters.join("\n");
  const { data: loaded } = useQuery({
    queryKey: ["adapter-history", colonyId, key, bucketSeconds, sinceMs ?? null],
    enabled,
    queryFn: async () => {
      const names = key.split("\n");
      const since = sinceMs === undefined ? historySince() : new Date(sinceMs).toISOString();
      const events: HistoryEvent[] = [];
      for (;;) {
        const page = unwrap(
          await supabase
            .rpc("adapter_history", { p_colony: colonyId, p_adapters: names, p_since: since, p_bucket_seconds: bucketSeconds })
            .range(events.length, events.length + PAGE_SIZE - 1),
        );
        events.push(...(page ?? []));
        if (!page || page.length < PAGE_SIZE) return events;
      }
    },
  });

  return useMemo(() => {
    if (!loaded) return undefined;
    const names = new Set(key.split("\n"));
    const last = loaded.length ? Date.parse(loaded[loaded.length - 1].received_at) : 0;
    // Live signals newer than the loaded history (older ones are already in it). Compare parsed
    // times: the database function and Realtime don't format timestamps identically.
    const fresh = live.filter((e) => names.has(e.adapter_name) && Date.parse(e.received_at) > last);
    return fresh.length ? [...loaded, ...fresh] : loaded;
  }, [loaded, key, live]);
}

/** The latest `limit` signals for the colony (optionally only some adapters), newest first, kept live. */
export function useRecentSignals(colonyId: string, live: AdapterEvent[], limit = 50, adapters?: string[]) {
  const key = adapters?.join("\n") ?? "";
  const { data: loaded } = useQuery({
    queryKey: ["recent-signals", colonyId, key, limit],
    queryFn: async () => {
      if (!key) return unwrap(await supabase.from("adapter_events").select("*").eq("colony_id", colonyId).order("id", { ascending: false }).limit(limit)) ?? [];
      // Named adapters (weather): read the merged stream, where the companion mod's weather
      // changes stand in for the stations' signals. Its ids aren't in time order, so sort by time.
      const rows = unwrap(
        await supabase
          .from("colony_signals")
          .select("*")
          .eq("colony_id", colonyId)
          .in("adapter_name", key.split("\n"))
          .order("received_at", { ascending: false })
          .limit(limit),
      );
      return (rows ?? []) as AdapterEvent[];
    },
  });

  return useMemo(() => {
    if (!loaded) return undefined;
    const names = key ? new Set(key.split("\n")) : undefined;
    const seen = new Set(loaded.map((e) => e.id));
    const fresh = live.filter((e) => !seen.has(e.id) && (!names || names.has(e.adapter_name))).reverse();
    return [...fresh, ...loaded].slice(0, limit);
  }, [loaded, live, limit, key]);
}

export type WeatherSlot = { adapter_name: string; slot_start: string; share: number };

/**
 * Which weather was on for most of each chart slot over HISTORY_DAYS (database function
 * `weather_history`): at most one row per slot however often the weather changed.
 */
export function useWeatherSlots(colonyId: string, adapters: string[], bucketSeconds: number, enabled = true): WeatherSlot[] | undefined {
  const key = adapters.join("\n");
  return useQuery({
    queryKey: ["weather-slots", colonyId, key, bucketSeconds],
    enabled,
    queryFn: async () =>
      unwrap(
        await supabase.rpc("weather_history", { p_colony: colonyId, p_adapters: key.split("\n"), p_since: historySince(), p_bucket_seconds: bucketSeconds }),
      ) ?? [],
  }).data;
}

/**
 * History for one number tracker from both sources, merged by the `tracker_history` database
 * function: the mod's readings while it was reporting, adapter signals for the rest. Loads again
 * when `version` changes (a new reading arrived). While the mod isn't reporting, live adapter
 * signals are appended as they arrive; while it is, they don't count.
 */
export function useTrackerHistory(
  colonyId: string,
  metric: string,
  adapters: string[],
  bucketSeconds: number,
  live: AdapterEvent[],
  options: { enabled: boolean; sinceMs?: number; reporting: boolean; version: number },
): TrackerHistoryRow[] | undefined {
  const { enabled, sinceMs, reporting, version } = options;
  const key = adapters.join("\n");
  const { data: loaded } = useQuery({
    queryKey: ["tracker-history", colonyId, metric, key, bucketSeconds, sinceMs ?? null, version],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const names = key ? key.split("\n") : [];
      const since = sinceMs === undefined ? historySince() : new Date(sinceMs).toISOString();
      const rows: TrackerHistoryRow[] = [];
      for (;;) {
        const page = unwrap(
          await supabase
            .rpc("tracker_history", { p_colony: colonyId, p_metric: metric, p_adapters: names, p_since: since, p_bucket_seconds: bucketSeconds })
            .range(rows.length, rows.length + PAGE_SIZE - 1),
        );
        rows.push(...(page ?? []));
        if (!page || page.length < PAGE_SIZE) return rows;
      }
    },
  });

  return useMemo(() => {
    if (!loaded || reporting) return loaded;
    const names = new Set(key.split("\n"));
    const last = loaded.length ? Date.parse(loaded[loaded.length - 1].at) : 0;
    // Compare parsed times: the database function and Realtime don't format timestamps identically.
    const fresh = live.filter((e) => names.has(e.adapter_name) && Date.parse(e.received_at) > last);
    if (!fresh.length) return loaded;
    return [...loaded, ...fresh.map((e) => ({ source: "adapter", at: e.received_at, value: null, adapter_name: e.adapter_name, state: e.state }))];
  }, [loaded, key, live, reporting]);
}
