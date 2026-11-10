import { useEffect, useState } from "react";
import { supabase, type AdapterEvent, type AdapterState } from "./supabase";

const HISTORY_DAYS = 7;
const HISTORY_LIMIT = 5000;

export type ColonyFeed = {
  loading: boolean;
  /** Latest known state per adapter name. */
  states: Map<string, AdapterState>;
  /** Events from the last HISTORY_DAYS, oldest first. */
  events: AdapterEvent[];
};

/** Adapter states + recent events for a colony, kept live with Supabase Realtime. */
export function useColonyFeed(colonyId: string): ColonyFeed {
  const [feed, setFeed] = useState<ColonyFeed>({ loading: true, states: new Map(), events: [] });

  useEffect(() => {
    let cancelled = false;
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();

    Promise.all([
      supabase.from("adapter_states").select("*").eq("colony_id", colonyId),
      supabase
        .from("adapter_events")
        .select("*")
        .eq("colony_id", colonyId)
        .gte("received_at", since)
        .order("received_at", { ascending: false })
        .limit(HISTORY_LIMIT),
    ]).then(([s, e]) => {
      if (cancelled) return;
      const loadedStates = (s.data ?? []).map((x) => [x.name, x] as const);
      const loadedEvents = [...(e.data ?? [])].reverse(); // oldest first
      // Updater must stay pure (StrictMode runs it twice), hence no in-place reverse here.
      setFeed((prev) => ({
        loading: false,
        // Keep anything Realtime delivered while we were loading.
        states: new Map([...loadedStates, ...prev.states]),
        events: mergeEvents(loadedEvents, prev.events),
      }));
    });

    const channel = supabase
      .channel(`colony-feed:${colonyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "adapter_events", filter: `colony_id=eq.${colonyId}` },
        (payload) => {
          const ev = payload.new as AdapterEvent;
          setFeed((prev) => {
            const states = new Map(prev.states);
            states.set(ev.adapter_name, {
              colony_id: ev.colony_id,
              name: ev.adapter_name,
              state: ev.state,
              updated_at: ev.received_at,
            });
            return { ...prev, states, events: mergeEvents(prev.events, [ev]) };
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

function mergeEvents(a: AdapterEvent[], b: AdapterEvent[]): AdapterEvent[] {
  if (b.length === 0) return a;
  const seen = new Set(a.map((e) => e.id));
  return [...a, ...b.filter((e) => !seen.has(e.id))].sort((x, y) => x.id - y.id);
}
