import { useEffect, useState } from "react";
import { supabase, type Colony, type Ladder } from "./supabase";

/** undefined = loading, null = not found / not yours. */
export function useColony(id: string | undefined) {
  const [colony, setColony] = useState<Colony | null>();
  useEffect(() => {
    if (!id) return;
    supabase.from("colonies").select("*").eq("id", id).maybeSingle().then(({ data }) => setColony(data));
  }, [id]);
  return [colony, setColony] as const;
}

export function useLadders(colonyId: string | undefined) {
  const [ladders, setLadders] = useState<Ladder[]>();
  useEffect(() => {
    if (!colonyId) return;
    supabase
      .from("ladders")
      .select("*")
      .eq("colony_id", colonyId)
      .order("created_at")
      .then(({ data }) => setLadders(data ?? []));
  }, [colonyId]);
  return ladders;
}
