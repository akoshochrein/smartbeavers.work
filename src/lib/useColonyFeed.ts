import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { keys, unwrap } from "./queries";
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
  const { data: loaded } = useQuery({
    queryKey: keys.adapterStates(colonyId),
    queryFn: async () => unwrap(await supabase.from("adapter_states").select("*").eq("colony_id", colonyId)) ?? [],
  });

  // Signals Realtime delivered while this page has been open, for this colony only.
  const [live, setLive] = useState<{ colonyId: string; events: AdapterEvent[] }>({ colonyId, events: [] });

  useEffect(() => {
    setLive({ colonyId, events: [] });
    const channel = supabase
      .channel(`colony-feed:${colonyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "adapter_events", filter: `colony_id=eq.${colonyId}` },
        (payload) => {
          const ev = payload.new as AdapterEvent;
          setLive((prev) => (prev.events.some((e) => e.id === ev.id) ? prev : { colonyId, events: [...prev.events, ev] }));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [colonyId]);

  return useMemo(() => {
    const events = live.colonyId === colonyId ? live.events : [];
    const states = new Map((loaded ?? []).map((s) => [s.name, s] as const));
    // A live signal replaces the loaded state unless the loaded one is newer (it was fetched later).
    for (const ev of events) {
      const known = states.get(ev.adapter_name);
      if (known && Date.parse(known.updated_at) > Date.parse(ev.received_at)) continue;
      states.set(ev.adapter_name, { colony_id: ev.colony_id, name: ev.adapter_name, state: ev.state, updated_at: ev.received_at });
    }
    return { loading: loaded === undefined, states, live: events };
  }, [loaded, live, colonyId]);
}
