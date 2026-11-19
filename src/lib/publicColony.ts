import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { exactValue, latestValue, lowerBound, metricFor, trackerHistory, type Comparison, type HistoryPoint, type Metric, type Value } from "@/shared/ladders";
import { weatherForAdapter, type Weather } from "@/shared/weather";
import { unwrap } from "./queries";
import { supabase } from "./supabase";

// What anyone can read of a public colony. Everything here comes through the database's
// public_colony* functions (docs/adr/0002): no table is read, and the only real clock time is
// when the colony was last heard from. History arrives placed in game days, not in time.

/** How often the public pages check again, so nothing on them goes stale. */
const REFRESH_MS = 20_000;

/**
 * History positions are turned into pretend times, one day apart per game day, so the charts
 * built for real times can draw them. They are only ever shown as "N game days ago".
 */
const DAY_MS = 86_400_000;

export type PublicColony = {
  /** Opaque and stable per colony; what the other functions are asked with. */
  key: string;
  name: string;
  faction: string | null;
  handle: string;
  picture: { path: string; version: string } | null;
  lastHeardAt: number;
};

/** A public colony by its address. null if no public colony has it; undefined while loading. */
export function usePublicColony(handle: string, slug: string): PublicColony | null | undefined {
  return useQuery({
    queryKey: ["public-colony", handle.toLowerCase(), slug],
    refetchInterval: REFRESH_MS,
    queryFn: async (): Promise<PublicColony | null> => {
      const row = unwrap(await supabase.rpc("public_colony", { p_handle: handle, p_slug: slug }))?.[0];
      if (!row) return null;
      return {
        key: row.key,
        name: row.colony_name,
        faction: row.faction,
        handle: row.handle,
        picture: row.avatar_path ? { path: row.avatar_path, version: row.profile_updated_at } : null,
        lastHeardAt: Date.parse(row.last_signal_at),
      };
    },
  }).data;
}

export type PublicNumber = {
  metric: Metric;
  comparison: Comparison;
  /** The player set a tracker up for it (as opposed to only the mod reporting it). */
  tracked: boolean;
  pinned: boolean;
  value: Value;
};

export type PublicPeriod = { weather: Weather; days: number; ongoing: boolean };

export type PublicOverview = {
  lastHeardAt: number | null;
  /** The game is sending right now. */
  running: boolean;
  date: { cycle: number; day: number } | null;
  /** Game days in the window the page shows. 0 for a colony with no game days counted. */
  days: number;
  /** Where "now" sits in the window, in game days from its start. */
  nowX: number;
  weather: { now: Weather; days: number | null } | null;
  weatherCounts: Record<Weather, number>;
  /** Weather periods in the window, oldest first. */
  periods: PublicPeriod[];
  numbers: PublicNumber[];
};

type RawOverview = {
  last_heard_at: string | null;
  running: boolean;
  date: { cycle: number; day: number } | null;
  days: number;
  now_x: number | null;
  weather: { now: string; days: number | null } | null;
  weather_counts: Record<string, number>;
  periods: { weather: string; days: number; ongoing: boolean }[];
  numbers: { metric: string; comparison: string; tracked: boolean; pinned: boolean; reading: number | null; steps: { threshold: number; on: boolean; order: number }[] }[];
};

function toOverview(raw: RawOverview): PublicOverview {
  const count = (adapter: string) => raw.weather_counts[adapter] ?? 0;
  const now = raw.weather ? weatherForAdapter(raw.weather.now)?.key : undefined;
  return {
    lastHeardAt: raw.last_heard_at ? Date.parse(raw.last_heard_at) : null,
    running: raw.running,
    date: raw.date,
    days: raw.days,
    nowX: raw.now_x ?? 0,
    weather: now ? { now, days: raw.weather!.days } : null,
    weatherCounts: { temperate: count("WeatherTemperate"), drought: count("WeatherDrought"), badtide: count("WeatherBadtide") },
    periods: raw.periods.flatMap((p) => {
      const weather = weatherForAdapter(p.weather)?.key;
      return weather ? [{ weather, days: p.days, ongoing: p.ongoing }] : [];
    }),
    numbers: raw.numbers.map((n) => {
      const comparison = n.comparison as Comparison;
      return {
        metric: metricFor(n.metric),
        comparison,
        tracked: n.tracked,
        pinned: n.pinned,
        // The mod's number when that is the value; otherwise what the counters pin down. Counters
        // come with the order they last switched in, which is all "the latest one" needs.
        value: n.reading != null ? exactValue(n.reading, 0) : latestValue(n.steps.map((s) => ({ bound: lowerBound(s.threshold, comparison), state: s.on, at: s.order }))),
      };
    }),
  };
}

/** Everything the public colony page shows apart from histories. null once the colony is no longer public. */
export function usePublicOverview(key: string | undefined): PublicOverview | null | undefined {
  return useQuery({
    queryKey: ["public-colony-overview", key],
    enabled: !!key,
    refetchInterval: REFRESH_MS,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const raw = unwrap(await supabase.rpc("public_colony_overview", { p_key: key! })) as RawOverview | null;
      return raw ? toOverview(raw) : null;
    },
  }).data;
}

/**
 * One number's history, oldest first, as points on the pretend timeline (see DAY_MS). Empty for
 * a colony with no game days counted. undefined while loading.
 */
export function usePublicHistory(key: string | undefined, number: Pick<PublicNumber, "metric" | "comparison"> | undefined, enabled = true): HistoryPoint[] | undefined {
  const metric = number?.metric.prefix;
  const comparison = number?.comparison;
  return useQuery({
    queryKey: ["public-colony-history", key, metric, comparison],
    enabled: enabled && !!key && !!metric,
    refetchInterval: REFRESH_MS,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const rows = unwrap(await supabase.rpc("public_colony_history", { p_key: key!, p_metric: metric! })) ?? [];
      return trackerHistory(
        { metric: metric!, comparison: comparison! },
        rows.map((r) => ({
          source: r.source,
          at: new Date(r.x * DAY_MS).toISOString(),
          value: r.value,
          adapter_name: r.threshold != null ? `${metric}${r.threshold}` : null,
          state: r.state,
        })),
      );
    },
  }).data;
}

/** The pretend timeline for the window: when each game day "began", and "now". */
export function publicTimeline(overview: Pick<PublicOverview, "days" | "nowX">) {
  return { dayStarts: Array.from({ length: overview.days }, (_, i) => i * DAY_MS), now: overview.nowX * DAY_MS };
}
