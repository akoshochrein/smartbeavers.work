import { useEffect, useState } from "react";
import { supabase, type AdapterEvent, type AdapterState } from "./supabase";

/** How much signal history trackers chart. */
export const HISTORY_DAYS = 180;

export type ColonyFeed = {
  loading: boolean;
  /** Latest known state per adapter name. */
  states: Map<string, AdapterState>;
  /** Signals received while this page has been open, oldest first. History is loaded per tracker. */
  live: AdapterEvent[];
};

/**
 * Current adapter states plus a live stream of new signals (Supabase Realtime).
 * Deliberately loads no history: each tracker asks for just the slice it charts.
 */
export function useColonyFeed(colonyId: string): ColonyFeed {
  const [feed, setFeed] = useState<ColonyFeed>({ loading: true, states: new Map(), live: [] });

  useEffect(() => {
    let cancelled = false;
    setFeed({ loading: true, states: new Map(), live: [] });

    supabase
      .from("adapter_states")
      .select("*")
      .eq("colony_id", colonyId)
      .then(({ data }) => {
        if (cancelled) return;
        const loaded = (data ?? []).map((x) => [x.name, x] as const);
        // Keep anything Realtime delivered while we were loading (it's newer).
        setFeed((prev) => ({ ...prev, loading: false, states: new Map([...loaded, ...prev.states]) }));
      });

    const channel = supabase
      .channel(`colony-feed:${colonyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "adapter_events", filter: `colony_id=eq.${colonyId}` },
        (payload) => {
          const ev = payload.new as AdapterEvent;
          setFeed((prev) => {
            if (prev.live.some((e) => e.id === ev.id)) return prev;
            const states = new Map(prev.states);
            states.set(ev.adapter_name, { colony_id: ev.colony_id, name: ev.adapter_name, state: ev.state, updated_at: ev.received_at });
            return { ...prev, states, live: [...prev.live, ev] };
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [colonyId]);

  return feed;
}
