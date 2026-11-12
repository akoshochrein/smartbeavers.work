import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keys, unwrap } from "./queries";
import { supabase, type Colony, type Ladder } from "./supabase";

/** undefined = loading, null = not found / not yours. The setter updates the cached copy. */
export function useColony(id: string | undefined) {
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: keys.colony(id ?? ""),
    enabled: !!id,
    queryFn: async () => unwrap(await supabase.from("colonies").select("*").eq("id", id!).maybeSingle()),
  });
  const setColony = (colony: Colony) => client.setQueryData(keys.colony(colony.id), colony);
  return [data, setColony] as const;
}

export function useLadders(colonyId: string | undefined): Ladder[] | undefined {
  return useQuery({
    queryKey: keys.ladders(colonyId ?? ""),
    enabled: !!colonyId,
    queryFn: async () => unwrap(await supabase.from("ladders").select("*").eq("colony_id", colonyId!).order("created_at")) ?? [],
  }).data;
}

/** Whether the colony tracks weather: undefined while loading. */
export function useWeatherTracker(colonyId: string | undefined) {
  const { data } = useQuery({
    queryKey: keys.weatherTracker(colonyId ?? ""),
    enabled: !!colonyId,
    queryFn: async () => !!unwrap(await supabase.from("weather_trackers").select("colony_id").eq("colony_id", colonyId!).maybeSingle()),
  });
  return [data] as const;
}
