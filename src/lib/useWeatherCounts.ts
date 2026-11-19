import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { WEATHERS, type Weather } from "@/shared/weather";
import { supabase } from "./supabase";

/**
 * All-time number of times each weather started (its station switched on).
 * `version` should change when new weather signals arrive so the counts refresh.
 */
export function useWeatherCounts(colonyId: string, version: number) {
  return useQuery({
    queryKey: ["weather-counts", colonyId, version],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // Counted in the database: starts still in history plus the totals kept from deleted history.
      const { data, error } = await supabase.rpc("weather_counts", { p_colony: colonyId });
      if (error) throw new Error(error.message);
      const byAdapter = new Map((data ?? []).map((r) => [r.adapter_name, r.n]));
      return Object.fromEntries(WEATHERS.map((w) => [w.key, byAdapter.get(w.adapter) ?? 0])) as Record<Weather, number>;
    },
  }).data;
}
