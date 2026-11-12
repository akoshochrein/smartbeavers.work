import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { StatusDot } from "@/components/app/StatusDot";
import { ValueChart } from "@/components/ValueChart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGameDayStarts } from "@/lib/clock";
import { CHART_BUCKET_SECONDS, useAdapterHistory } from "@/lib/history";
import type { Ladder } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";
import { HISTORY_DAYS, type ColonyFeed } from "@/lib/useColonyFeed";
import { describeValue, discoverSteps, formatValue, ladderHistory, latestValue, metricFor, valueSuffix, type Step } from "@/shared/ladders";
import { GoodIcon } from "@/components/app/GoodIcon";

const LIVE_MS = 5 * 60_000;
/** With a game clock, the chart shows this many game days (the same window as the weather strip). */
const GAME_DAY_WINDOW = 180;

export function TrackerCard({
  ladder,
  feed,
  clock = false,
  dayVersion,
}: {
  ladder: Ladder;
  feed: ColonyFeed;
  /** The colony has a game clock: chart in game days instead of real time. */
  clock?: boolean;
  dayVersion?: number;
}) {
  const metric = metricFor(ladder.metric);
  const suffix = valueSuffix(metric);
  const now = useNow(30_000);

  const steps = useMemo(() => discoverSteps(ladder, feed.states.values()), [ladder, feed.states]);
  const value = latestValue(steps);
  const names = useMemo(() => steps.map((s) => s.name), [steps]);
  // Game days: the chart spans the clock's recent day signals. Real time: the last HISTORY_DAYS.
  const dayStarts = useGameDayStarts(ladder.colony_id, GAME_DAY_WINDOW, clock, dayVersion);
  const gameDays = clock && !!dayStarts?.length;
  // Fixed once known, so a new game day doesn't reload the history; the chart trims to the window.
  const [since, setSince] = useState<number>();
  if (gameDays && since === undefined) setSince(dayStarts[0]);
  const bucket = since === undefined ? CHART_BUCKET_SECONDS : Math.max(1, Math.round((Date.now() - since) / 1000 / 360));
  const ready = names.length > 0 && (!clock || dayStarts !== undefined) && (!gameDays || since !== undefined);
  const events = useAdapterHistory(ladder.colony_id, names, bucket, feed.live, ready, gameDays ? since : undefined);
  const history = useMemo(() => (events ? ladderHistory(ladder, events) : []), [ladder, events]);

  const live = value.kind !== "waiting" && now - value.at < LIVE_MS;

  return (
    <article className="rounded-2xl border bg-paper p-5 sm:p-6">
      <header className="flex items-center gap-3">
        {metric.kind === "resource" && <GoodIcon good={metric.prefix} className="size-7" />}
        <h2 className="text-xl font-semibold">{metric.label}</h2>
        <Button asChild variant="ghost" size="sm" className="ml-auto text-cobalt-deep hover:text-cobalt-deep">
          <Link to="/colonies/$id/trackers/$ladderId" params={{ id: ladder.colony_id, ladderId: ladder.id }}>Setup guide</Link>
        </Button>
      </header>

      <div className="mt-4 min-h-[6.5rem]">
        {feed.loading ? (
          <div className="space-y-3 pt-1">
            <Skeleton className="h-14 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        ) : value.kind === "waiting" ? (
          <div>
            <div className="flex items-center gap-2.5 text-sm text-ink-soft">
              <StatusDot state={undefined} live className="size-2" /> Listening
            </div>
            <p className="mt-2 font-display text-xl leading-tight font-semibold">Waiting for the first counter</p>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-soft">
              Name an adapter <span className="font-mono text-[13px]">{metric.prefix}</span> plus its counter's number, such as{" "}
              <span className="font-mono text-[13px]">{metric.prefix}{metric.kind === "resource" ? 50 : 30}</span>. It shows up here the next time it switches on or off.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <div className="relative h-12 min-w-0 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={formatValue(value, suffix)}
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -40, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 24 }}
                    className="font-display text-5xl leading-none font-bold tracking-tight whitespace-nowrap tabular-nums"
                  >
                    {formatValue(value, suffix)}
                  </motion.div>
                </AnimatePresence>
              </div>
              <span className="text-lg text-ink-soft">{metric.unit}</span>
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
              <StatusDot state live={live} className="size-2" />
              {describeValue(value, suffix)} {timeAgo(value.at, now)}
            </p>
          </>
        )}
      </div>

      {steps.length > 0 && !feed.loading && <CounterNote steps={steps} prefix={metric.prefix} suffix={suffix} />}

      {history.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <div className="mb-2 text-sm text-ink-soft">
            {!gameDays ? `Last ${HISTORY_DAYS} days` : dayStarts.length >= GAME_DAY_WINDOW ? `Last ${GAME_DAY_WINDOW} game days` : "Since the game clock started"}
          </div>
          <ValueChart
            points={history}
            now={now}
            unit={metric.unit}
            suffix={suffix}
            domain={metric.kind === "resource" ? [0, 100] : undefined}
            dayStarts={gameDays ? dayStarts : undefined}
          />
        </div>
      )}
    </article>
  );
}

/**
 * Which counters feed this tracker, and what that leaves unknown: with every counter on, the
 * real number may be above the highest one; with every counter off, below the lowest.
 */
function CounterNote({ steps, prefix, suffix }: { steps: Step[]; prefix: string; suffix: string }) {
  const n = (v: number) => `${v.toLocaleString()}${suffix}`;
  const bounds = steps.map((s) => s.bound);
  const lowest = bounds[0];
  const highest = bounds[bounds.length - 1];
  const list =
    bounds.length === 1
      ? `One counter, at ${n(lowest)}`
      : bounds.length <= 4
        ? `Counters at ${bounds.slice(0, -1).map(n).join(", ")} and ${n(highest)}`
        : `${bounds.length} counters from ${n(lowest)} to ${n(highest)}`;
  const allOn = steps.every((s) => s.state);
  const allOff = steps.every((s) => !s.state);
  return (
    <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
      {list}.
      {allOn && (
        <>
          {" "}
          All of them are on, so the real number may be higher than {n(highest)}. To follow it further, add a counter above {n(highest)} with
          an adapter named <span className="font-mono text-[13px]">{prefix}</span> plus its number.
        </>
      )}
      {allOff && bounds.length > 0 && !allOn && (
        <>
          {" "}
          All of them are off, so the real number is somewhere below {n(lowest)}. To follow it further, add a counter below {n(lowest)}.
        </>
      )}
    </p>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
