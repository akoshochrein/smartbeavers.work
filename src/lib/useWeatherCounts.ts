import { useEffect, useState } from "react";
import { WEATHERS, type Weather } from "@/shared/weather";
import { supabase } from "./supabase";

/**
 * All-time number of times each weather started (its station switched on).
 * `version` should change when new weather signals arrive so the counts refresh.
 */
export function useWeatherCounts(colonyId: string, version: number) {
  const [counts, setCounts] = useState<Record<Weather, number>>();
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      WEATHERS.map((w) =>
        supabase
          .from("adapter_events")
          .select("id", { count: "exact", head: true })
          .eq("colony_id", colonyId)
          .eq("adapter_name", w.adapter)
          .eq("state", true)
          .then(({ count }) => [w.key, count ?? 0] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setCounts(Object.fromEntries(entries) as Record<Weather, number>);
    });
    return () => {
      cancelled = true;
    };
  }, [colonyId, version]);
  return counts;
}
