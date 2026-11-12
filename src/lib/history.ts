import { useEffect, useMemo, useState } from "react";
import { supabase, type AdapterEvent } from "./supabase";
import { HISTORY_DAYS } from "./useColonyFeed";

export type HistoryEvent = { adapter_name: string; state: boolean; received_at: string; carried?: boolean };

/** Supabase caps each response at this many rows (API max_rows). */
const PAGE_SIZE = 1000;
/** ~360 points per adapter over the window: finer than a chart a few hundred pixels wide can show. */
export const CHART_BUCKET_SECONDS = Math.round((HISTORY_DAYS * 86_400) / 360);

/**
 * History for a few adapters over the last HISTORY_DAYS, shaped by the `adapter_history`
 * database function: their states when the window opened, then the last signal per adapter per
 * `bucketSeconds` (0 = every signal). Live signals for these adapters are appended as they arrive.
 */
export function useAdapterHistory(colonyId: string, adapters: string[], bucketSeconds: number, live: AdapterEvent[], enabled = true) {
  const key = adapters.join("\n");
  const [loaded, setLoaded] = useState<{ key: string; events: HistoryEvent[] }>();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const names = key.split("\n");
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
    (async () => {
      const events: HistoryEvent[] = [];
      for (;;) {
        const { data, error } = await supabase
          .rpc("adapter_history", { p_colony: colonyId, p_adapters: names, p_since: since, p_bucket_seconds: bucketSeconds })
          .range(events.length, events.length + PAGE_SIZE - 1);
        if (error || !data) break;
        events.push(...data);
        if (data.length < PAGE_SIZE) break;
      }
      if (!cancelled) setLoaded({ key, events });
    })();
    return () => {
      cancelled = true;
    };
  }, [colonyId, key, bucketSeconds, enabled]);

  return useMemo(() => {
    if (!loaded || loaded.key !== key) return undefined;
    const names = new Set(adapters);
    const last = loaded.events.length ? Date.parse(loaded.events[loaded.events.length - 1].received_at) : 0;
    // Live signals newer than the loaded history (older ones are already in it). Compare parsed
    // times: the database function and Realtime don't format timestamps identically.
    const fresh = live.filter((e) => names.has(e.adapter_name) && Date.parse(e.received_at) > last);
    return fresh.length ? [...loaded.events, ...fresh] : loaded.events;
  }, [loaded, key, live]);
}

/** The latest `limit` signals for the colony (optionally only some adapters), newest first, kept live. */
export function useRecentSignals(colonyId: string, live: AdapterEvent[], limit = 50, adapters?: string[]) {
  const key = adapters?.join("\n") ?? "";
  const [loaded, setLoaded] = useState<{ key: string; events: AdapterEvent[] }>();

  useEffect(() => {
    let cancelled = false;
    let query = supabase.from("adapter_events").select("*").eq("colony_id", colonyId);
    if (key) query = query.in("adapter_name", key.split("\n"));
    query
      .order("id", { ascending: false })
      .limit(limit)
      .then(({ data }) => !cancelled && setLoaded({ key, events: data ?? [] }));
    return () => {
      cancelled = true;
    };
  }, [colonyId, limit, key]);

  return useMemo(() => {
    if (!loaded || loaded.key !== key) return undefined;
    const names = key ? new Set(key.split("\n")) : undefined;
    const seen = new Set(loaded.events.map((e) => e.id));
    const fresh = live.filter((e) => !seen.has(e.id) && (!names || names.has(e.adapter_name))).reverse();
    return [...fresh, ...loaded.events].slice(0, limit);
  }, [loaded, live, limit, key]);
}

export type WeatherSlot = { adapter_name: string; slot_start: string; share: number };

/**
 * Which weather was on for most of each chart slot over HISTORY_DAYS (database function
 * `weather_history`): at most one row per slot however often the weather changed.
 */
export function useWeatherSlots(colonyId: string, adapters: string[], bucketSeconds: number, enabled = true) {
  const key = adapters.join("\n");
  const [slots, setSlots] = useState<{ key: string; rows: WeatherSlot[] }>();
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
    supabase
      .rpc("weather_history", { p_colony: colonyId, p_adapters: key.split("\n"), p_since: since, p_bucket_seconds: bucketSeconds })
      .then(({ data }) => !cancelled && setSlots({ key, rows: data ?? [] }));
    return () => {
      cancelled = true;
    };
  }, [colonyId, key, bucketSeconds, enabled]);
  return slots && slots.key === key ? slots.rows : undefined;
}
