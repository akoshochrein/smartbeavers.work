import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { unwrap } from "./queries";
import { supabase } from "./supabase";

/** The companion mod's latest value for one metric. */
export type Reading = {
  value: number;
  /** When the value last changed (ms since epoch). */
  at: number;
  /** The mod is reporting right now, so this is the colony's value. Otherwise adapters, if any, take over. */
  reporting: boolean;
};

/** One stored reading, as Realtime delivers it. */
export type ReadingRow = { id: number; colony_id: string; metric: string; value: number; received_at: string };

export type ColonyReadings = {
  /** Latest reading per metric. Empty for a colony the mod has never reported for. */
  byMetric: Map<string, Reading>;
  /** Readings that arrived while this page has been open, oldest first. */
  live: ReadingRow[];
  /** Goes up each time a new reading arrives, for anything that has to load again. */
  version: number;
};

const key = (colonyId: string) => ["latest-readings", colonyId] as const;

/**
 * The mod's latest readings for a colony (database view `latest_readings`), kept current: new
 * readings arrive through Realtime, and a check every minute notices when the mod stops reporting.
 * undefined while loading.
 */
export function useColonyReadings(colonyId: string): ColonyReadings | undefined {
  const client = useQueryClient();
  const [live, setLive] = useState<{ colonyId: string; rows: ReadingRow[] }>({ colonyId, rows: [] });
  const { data } = useQuery({
    queryKey: key(colonyId),
    refetchInterval: 60_000,
    queryFn: async () => unwrap(await supabase.from("latest_readings").select("metric, value, received_at, reporting").eq("colony_id", colonyId)) ?? [],
  });

  useEffect(() => {
    setLive({ colonyId, rows: [] });
    const channel = supabase
      .channel(`colony-readings:${colonyId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "readings", filter: `colony_id=eq.${colonyId}` }, (payload) => {
        const row = payload.new as ReadingRow;
        setLive((prev) => (prev.rows.some((r) => r.id === row.id) ? prev : { colonyId, rows: [...prev.rows, row] }));
        client.invalidateQueries({ queryKey: key(colonyId) });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [colonyId, client]);

  return useMemo(() => {
    if (!data) return undefined;
    const byMetric = new Map<string, Reading>();
    for (const r of data) {
      if (r.metric === null || r.value === null || r.received_at === null) continue;
      byMetric.set(r.metric, { value: r.value, at: Date.parse(r.received_at), reporting: !!r.reporting });
    }
    const rows = live.colonyId === colonyId ? live.rows : [];
    return { byMetric, live: rows, version: rows.length };
  }, [data, live, colonyId]);
}

const pinsKey = (colonyId: string) => ["pinned-metrics", colonyId] as const;

/** Metrics the player pinned to the colony's page, and how to change them. undefined while loading. */
export function usePinnedMetrics(colonyId: string) {
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: pinsKey(colonyId),
    queryFn: async () => new Set((unwrap(await supabase.from("pinned_metrics").select("metric").eq("colony_id", colonyId)) ?? []).map((r) => r.metric)),
  });
  /** Pins or unpins, and returns an error message if it didn't work. */
  async function setPinned(metric: string, pinned: boolean): Promise<string | undefined> {
    const { error } = pinned
      ? await supabase.from("pinned_metrics").upsert({ colony_id: colonyId, metric }, { ignoreDuplicates: true })
      : await supabase.from("pinned_metrics").delete().eq("colony_id", colonyId).eq("metric", metric);
    await client.invalidateQueries({ queryKey: pinsKey(colonyId) });
    return error?.message;
  }
  return [data, setPinned] as const;
}

/** How long after its last request the mod still counts as reporting, unless it said goodbye. The database uses the same five minutes. */
const REPORTING_MS = 5 * 60_000;

/** The companion mod's latest session for a colony. */
export type ModStatus = {
  /** When the mod was last heard from (ms since epoch). */
  lastSeen: number;
  /** When it stops counting as reporting: when it said goodbye, or five minutes after it was last heard from. */
  until: number;
};

/**
 * The companion mod's latest session for this colony: undefined while loading, null if it has
 * never reported. Kept current through Realtime (a heartbeat, a goodbye), with a check every
 * minute as a fallback and a re-render every 20 seconds so "reporting" lapses on time.
 */
export function useModStatus(colonyId: string): ModStatus | null | undefined {
  const client = useQueryClient();
  const queryKey = useMemo(() => ["mod-status", colonyId] as const, [colonyId]);
  const [, tick] = useState(0);
  const { data } = useQuery({
    queryKey,
    refetchInterval: 60_000,
    queryFn: async (): Promise<ModStatus | null> => {
      const rows = unwrap(
        await supabase.from("mod_sessions").select("last_seen_at, ended_at").eq("colony_id", colonyId).order("last_seen_at", { ascending: false }).limit(1),
      );
      const row = rows?.[0];
      if (!row) return null;
      const lastSeen = Date.parse(row.last_seen_at);
      return { lastSeen, until: row.ended_at ? Date.parse(row.ended_at) : lastSeen + REPORTING_MS };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`colony-mod:${colonyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mod_sessions", filter: `colony_id=eq.${colonyId}` }, () => {
        client.invalidateQueries({ queryKey });
        // Whether each reading counts as live depends on the session too.
        client.invalidateQueries({ queryKey: key(colonyId) });
      })
      .subscribe();
    const timer = setInterval(() => tick((n) => n + 1), 20_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [colonyId, client, queryKey]);

  return data;
}

export const isReporting = (status: ModStatus | null | undefined, now = Date.now()) => !!status && now < status.until;
