import { useQuery } from "@tanstack/react-query";
import { keys, unwrap, useInvalidate } from "./queries";
import { supabase, type Colony } from "./supabase";

/** The signed-in player's colonies. One cached list shared by the sidebar and the pages. */
export function useColonies(): { colonies: Colony[] | undefined; reload: () => Promise<unknown> } {
  const { data } = useQuery({
    queryKey: keys.colonies,
    queryFn: async () => unwrap(await supabase.from("colonies").select("*").order("created_at")) ?? [],
  });
  const invalidate = useInvalidate();
  return { colonies: data, reload: () => invalidate(keys.colonies) };
}
