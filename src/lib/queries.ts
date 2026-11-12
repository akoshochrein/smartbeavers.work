import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Query keys for everything read from Supabase. Keys start with the thing and, where there is
 * one, the colony id, so one colony's data can be refreshed together.
 */
export const keys = {
  colonies: ["colonies"] as const,
  colonySummaries: ["colonies", "summaries"] as const,
  colony: (id: string) => ["colony", id] as const,
  ladders: (colonyId: string) => ["ladders", colonyId] as const,
  weatherTracker: (colonyId: string) => ["weather-tracker", colonyId] as const,
  gameClock: (colonyId: string) => ["game-clock", colonyId] as const,
  gameDate: (colonyId: string) => ["game-date", colonyId] as const,
  adapterStates: (colonyId: string) => ["adapter-states", colonyId] as const,
};

/** Supabase answers with `{ data, error }` instead of throwing; queries want a throw. */
export function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Marks cached data as out of date after a change, so everything showing it loads it again. */
export function useInvalidate() {
  const client = useQueryClient();
  return useCallback((...queryKeys: QueryKey[]) => Promise.all(queryKeys.map((queryKey) => client.invalidateQueries({ queryKey }))), [client]);
}
