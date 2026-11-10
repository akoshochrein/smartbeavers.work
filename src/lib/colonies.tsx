import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, type Colony } from "./supabase";

type ColoniesState = { colonies: Colony[] | undefined; reload: () => Promise<void> };

const ColoniesContext = createContext<ColoniesState>({ colonies: undefined, reload: async () => {} });

/** The signed-in player's colonies, shared by the sidebar and pages so both stay in sync. */
export function ColoniesProvider({ children }: { children: ReactNode }) {
  const [colonies, setColonies] = useState<Colony[]>();
  const reload = useCallback(async () => {
    const { data } = await supabase.from("colonies").select("*").order("created_at");
    setColonies(data ?? []);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return <ColoniesContext.Provider value={{ colonies, reload }}>{children}</ColoniesContext.Provider>;
}

export const useColonies = () => useContext(ColoniesContext);
