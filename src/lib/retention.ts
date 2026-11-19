import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/shared/database.types";
import { unwrap } from "./queries";
import { supabase } from "./supabase";

/** How long this deployment keeps history. A null setting means no limit. */
export type RetentionPolicy = Database["public"]["Tables"]["retention_settings"]["Row"];

/**
 * The deployment's retention settings, readable by anyone (database function `retention_policy`).
 * The privacy page states the policy from these, so it always says what really happens.
 * undefined while loading or if it couldn't be loaded.
 */
export function useRetentionPolicy(): RetentionPolicy | undefined {
  return useQuery({
    queryKey: ["retention-policy"],
    staleTime: 3_600_000,
    queryFn: async () => unwrap(await supabase.rpc("retention_policy")) as RetentionPolicy,
  }).data;
}

const plural = (n: number, unit: string) => `${n.toLocaleString()} ${unit}${n === 1 ? "" : "s"}`;

/** The policy as plain sentences, one per rule that applies. */
export function describeRetention(p: RetentionPolicy): string[] {
  const lines: string[] = [];
  const full = p.full_detail_hours;
  const hourly = p.hourly_days;
  const keep = p.keep_days;

  if (full === null) {
    lines.push(keep === null ? "Signals and readings are kept as they arrived, with no time limit." : `Signals and readings are kept as they arrived for ${plural(keep, "day")}, then deleted.`);
  } else {
    const thinned =
      hourly === null
        ? "After that only the last value of each hour is kept for each number"
        : `After that only the last value of each hour is kept for each number, and after ${plural(hourly, "day")} only the last value of each day`;
    lines.push(`Readings from the companion mod are kept in full for ${plural(full, "hour")}. ${thinned}.`);
    lines.push(
      keep === null
        ? "Signals from adapters, and changes of day, cycle and weather, are kept as they arrived. Nothing is deleted for being old."
        : `Signals from adapters, and changes of day, cycle and weather, are kept as they arrived. Everything older than ${plural(keep, "day")} is deleted.`,
    );
  }
  if (keep !== null) {
    lines.push("Two things outlive that: how many times each weather has started, and the game date, which is carried forward.");
  }
  if (p.silent_months !== null) {
    lines.push(
      `If a colony sends nothing for ${plural(p.silent_months, "month")}, its history is deleted. The colony, its trackers, its links and the last value of each number stay until you delete them.`,
    );
  }
  lines.push("This cleanup runs once a day.");
  return lines;
}
