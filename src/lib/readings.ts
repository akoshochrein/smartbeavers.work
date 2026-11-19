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

export type ColonyReadings = {
  /** Latest reading per metric. Empty for a colony the mod has never reported for. */
  byMetric: Map<string, Reading>;
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
  const [version, setVersion] = useState(0);
  const { data } = useQuery({
    queryKey: key(colonyId),
    refetchInterval: 60_000,
    queryFn: async () => unwrap(await supabase.from("latest_readings").select("metric, value, received_at, reporting").eq("colony_id", colonyId)) ?? [],
  });

  useEffect(() => {
    const channel = supabase
      .channel(`colony-readings:${colonyId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "readings", filter: `colony_id=eq.${colonyId}` }, () => {
        setVersion((v) => v + 1);
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
    return { byMetric, version };
  }, [data, version]);
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

/** How long after its last request the mod still counts as reporting. The database uses the same five minutes. */
const REPORTING_MS = 5 * 60_000;

/**
 * When the companion mod was last heard from for this colony: undefined while loading, null if
 * never. Checked every minute, because a heartbeat changes nothing a page would otherwise notice.
 */
export function useModLastSeen(colonyId: string, version: number): number | null | undefined {
  return useQuery({
    queryKey: ["mod-last-seen", colonyId, version],
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const rows = unwrap(await supabase.from("mod_sessions").select("last_seen_at").eq("colony_id", colonyId).order("last_seen_at", { ascending: false }).limit(1));
      return rows?.[0] ? Date.parse(rows[0].last_seen_at) : null;
    },
  }).data;
}

export const isReporting = (lastSeen: number | null | undefined, now = Date.now()) => !!lastSeen && now - lastSeen < REPORTING_MS;
