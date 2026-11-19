import { useMemo, useState } from "react";
import { CHART_BUCKET_SECONDS, useTrackerHistory } from "@/lib/history";
import type { Reading } from "@/lib/readings";
import type { Ladder } from "@/lib/supabase";
import type { ColonyFeed } from "@/lib/useColonyFeed";
import { discoverSteps, exactValue, latestValue, trackerHistory } from "@/shared/ladders";

/** What is needed to follow a tracker. A tracker the mod feeds on its own has no row behind it. */
export type TrackerLike = Pick<Ladder, "id" | "colony_id" | "metric" | "comparison">;

/**
 * One number tracker's current value and, when asked for, its history.
 *
 * The mod's number is the value while the mod is reporting. When it isn't, the newer of the two
 * is: counters that have switched since the mod's last number take over, silent ones don't.
 *
 * `dayStarts` (from the game clock) makes the history span the clock's recent days; without a
 * clock it spans the last HISTORY_DAYS of real time. Pass `clock` so the history waits for the
 * day starts instead of loading twice.
 */
export function useTracker(
  ladder: Pick<TrackerLike, "colony_id" | "metric" | "comparison">,
  feed: ColonyFeed,
  reading: Reading | undefined,
  options: { history: boolean; clock: boolean; dayStarts: number[] | undefined; readingsVersion: number },
) {
  const { clock, dayStarts, readingsVersion } = options;
  const steps = useMemo(() => discoverSteps(ladder, feed.states.values()), [ladder, feed.states]);
  const fromSteps = latestValue(steps);
  const newestStep = steps.reduce((t, s) => Math.max(t, s.at), 0);
  const exact = !!reading && (reading.reporting || newestStep <= reading.at);
  const value = exact ? exactValue(reading.value, reading.at) : fromSteps;
  const names = useMemo(() => steps.map((s) => s.name), [steps]);

  const gameDays = clock && !!dayStarts?.length;
  // Fixed once known, so a new game day doesn't reload the history; charts trim to the window.
  const [since, setSince] = useState<number>();
  if (gameDays && since === undefined) setSince(dayStarts![0]);
  const bucket = since === undefined ? CHART_BUCKET_SECONDS : Math.max(1, Math.round((Date.now() - since) / 1000 / 360));
  const ready = options.history && (names.length > 0 || !!reading) && (!clock || dayStarts !== undefined) && (!gameDays || since !== undefined);
  const rows = useTrackerHistory(ladder.colony_id, ladder.metric, names, bucket, feed.live, {
    enabled: ready,
    sinceMs: gameDays ? since : undefined,
    reporting: !!reading?.reporting,
    version: readingsVersion,
  });
  const history = useMemo(() => (rows ? trackerHistory(ladder, rows) : []), [ladder, rows]);

  return {
    steps,
    value,
    /** Oldest first. Empty until loaded, and for a tracker nothing has been received for. */
    history,
    /** The history has arrived (or there is nothing to load). */
    loaded: rows !== undefined || !(names.length > 0 || !!reading),
    gameDays,
  };
}
