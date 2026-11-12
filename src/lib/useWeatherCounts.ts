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
      const entries = await Promise.all(
        WEATHERS.map(async (w) => {
          const { count, error } = await supabase
            .from("adapter_events")
            .select("id", { count: "exact", head: true })
            .eq("colony_id", colonyId)
            .eq("adapter_name", w.adapter)
            .eq("state", true);
          if (error) throw new Error(error.message);
          return [w.key, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<Weather, number>;
    },
  }).data;
}
