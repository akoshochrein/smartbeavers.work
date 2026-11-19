import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { StatusDot } from "@/components/app/StatusDot";
import { ValueChart } from "@/components/ValueChart";
import { useGameDayStarts } from "@/lib/clock";
import { CHART_BUCKET_SECONDS, useTrackerHistory } from "@/lib/history";
import type { Reading } from "@/lib/readings";
import type { Ladder } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";
import { HISTORY_DAYS, type ColonyFeed } from "@/lib/useColonyFeed";
import { describeValue, discoverSteps, exactValue, formatValue, latestValue, metricFor, trackerHistory, valueSuffix, type Step } from "@/shared/ladders";
import { GoodIcon } from "@/components/app/GoodIcon";

const LIVE_MS = 5 * 60_000;
/** With a game clock, the chart shows this many game days (the same window as the weather strip). */
const GAME_DAY_WINDOW = 180;

/** What a tile needs to know about its tracker. A tracker the mod feeds on its own has no row behind it. */
export type TrackerLike = Pick<Ladder, "id" | "colony_id" | "metric" | "comparison">;

/**
 * One number tracker on the colony page: its name, value and when it last changed. Opening it
 * shows the chart, and for a tracker built from counters, which counters feed it and its setup
 * guide. A closed tile draws no chart and loads no history.
 */
export function TrackerTile({
  ladder,
  feed,
  reading,
  readingsVersion = 0,
  auto = false,
  clock = false,
  dayVersion,
  open,
  onToggle,
}: {
  ladder: TrackerLike;
  feed: ColonyFeed;
  /** The companion mod's latest value for this metric, if it has ever reported one. */
  reading?: Reading;
  /** Changes when a new reading arrives, so the history loads again. */
  readingsVersion?: number;
  /** Shown because the mod reports this metric, not because the player set a tracker up. */
  auto?: boolean;
  /** The colony has a game clock: chart in game days instead of real time. */
  clock?: boolean;
  dayVersion?: number;
  open: boolean;
  onToggle: () => void;
}) {
  const metric = metricFor(ladder.metric);
  const suffix = valueSuffix(metric);
  const resource = metric.kind === "resource";
  const now = useNow(30_000);
  const panelId = useId();

  const steps = useMemo(() => discoverSteps(ladder, feed.states.values()), [ladder, feed.states]);
  // The mod's number is the value while the mod is reporting. When it isn't, the newer of the
  // two is: counters that have switched since the mod's last number take over, silent ones don't.
  const fromSteps = latestValue(steps);
  const newestStep = steps.reduce((t, s) => Math.max(t, s.at), 0);
  const exact = !!reading && (reading.reporting || newestStep <= reading.at);
  const value = exact ? exactValue(reading.value, reading.at) : fromSteps;
  const names = useMemo(() => steps.map((s) => s.name), [steps]);
  // Game days: the chart spans the clock's recent day signals. Real time: the last HISTORY_DAYS.
  const dayStarts = useGameDayStarts(ladder.colony_id, GAME_DAY_WINDOW, clock && open, dayVersion);
  const gameDays = clock && !!dayStarts?.length;
  // Fixed once known, so a new game day doesn't reload the history; the chart trims to the window.
  const [since, setSince] = useState<number>();
  if (gameDays && since === undefined) setSince(dayStarts[0]);
  const bucket = since === undefined ? CHART_BUCKET_SECONDS : Math.max(1, Math.round((Date.now() - since) / 1000 / 360));
  const ready = open && (names.length > 0 || !!reading) && (!clock || dayStarts !== undefined) && (!gameDays || since !== undefined);
  const rows = useTrackerHistory(ladder.colony_id, ladder.metric, names, bucket, feed.live, {
    enabled: ready,
    sinceMs: gameDays ? since : undefined,
    reporting: !!reading?.reporting,
    version: readingsVersion,
  });
  const history = useMemo(() => (rows ? trackerHistory(ladder, rows) : []), [ladder, rows]);

  // A reading's time is when the number last changed, which can be long ago in a quiet colony:
  // what makes it live is the mod still reporting.
  const live = value.kind === "exact" ? !!reading?.reporting : value.kind !== "waiting" && now - value.at < LIVE_MS;
  // Counters only say which side of a number the value is on.
  const approximate = value.kind === "atLeast" || value.kind === "under";

  return (
    <article className="rounded-2xl border bg-paper">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="block w-full rounded-2xl p-4 text-left outline-offset-2 transition-colors hover:bg-mist/60 sm:p-5"
      >
        <span className="flex items-center gap-2.5">
          {resource && <GoodIcon good={metric.prefix} className="size-6 shrink-0" />}
          <span className="min-w-0 flex-1 truncate text-base font-semibold">{metric.label}</span>
          {approximate && <span className="shrink-0 rounded-md bg-resin-soft px-1.5 py-0.5 text-xs">approximate</span>}
          <ChevronRight className={`size-4 shrink-0 text-ink-soft transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
        </span>

        {value.kind === "waiting" ? (
          <span className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
            <StatusDot state={undefined} live={!feed.loading} className="size-2" /> {feed.loading ? " " : "Waiting for the first counter"}
          </span>
        ) : (
          <>
            <span className="mt-3 flex items-baseline gap-2">
              <span className="relative block h-9 min-w-0 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={formatValue(value, suffix)}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -30, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 24 }}
                    className="block font-display text-4xl leading-9 font-bold tracking-tight whitespace-nowrap tabular-nums"
                  >
                    {formatValue(value, suffix)}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="text-sm text-ink-soft">{metric.unit}</span>
            </span>
            {resource && (
              <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-mist-2" aria-hidden>
                <span className="block h-full rounded-full bg-cobalt transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value.value))}%` }} />
              </span>
            )}
            <span className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
              <StatusDot state live={live} className="size-2" />
              {describeValue(value, suffix)} {timeAgo(value.at, now)}
            </span>
          </>
        )}
      </button>

      {open && (
        <div id={panelId} className="border-t px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
          {value.kind === "waiting" ? (
            <p className="max-w-md text-sm leading-relaxed text-ink-soft">
              Name an adapter <span className="font-mono text-[13px]">{metric.prefix}</span> plus its counter's number, such as{" "}
              <span className="font-mono text-[13px]">{metric.prefix}{resource ? 50 : 30}</span>. It shows up here the next time it switches on or off.
            </p>
          ) : history.length > 0 ? (
            <>
              <div className="mb-2 text-sm text-ink-soft">
                {!gameDays ? `Last ${HISTORY_DAYS} days` : dayStarts.length >= GAME_DAY_WINDOW ? `Last ${GAME_DAY_WINDOW} game days` : "Since the game clock started"}
              </div>
              <ValueChart points={history} now={now} unit={metric.unit} suffix={suffix} domain={resource ? [0, 100] : undefined} dayStarts={gameDays ? dayStarts : undefined} />
            </>
          ) : (
            <div className="h-[150px] animate-pulse rounded-lg bg-mist-2/60" aria-hidden />
          )}
          {steps.length > 0 && value.kind !== "exact" && <CounterNote steps={steps} prefix={metric.prefix} suffix={suffix} />}
          {!auto && (
            <p className="mt-3 text-sm">
              <Link to="/colonies/$id/trackers/$ladderId" params={{ id: ladder.colony_id, ladderId: ladder.id }} className="text-cobalt-deep underline-offset-4 hover:underline">
                Setup guide
              </Link>
            </p>
          )}
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
