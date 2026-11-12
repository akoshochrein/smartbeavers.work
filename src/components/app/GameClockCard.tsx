import { CalendarClock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { SetDateDialog } from "@/components/app/SetDateDialog";
import { StatusDot } from "@/components/app/StatusDot";
import { WeatherBadge } from "@/components/app/weather";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDayCounts, type GameDate } from "@/lib/clock";
import { useRecentSignals } from "@/lib/history";
import { formatTime } from "@/lib/time";
import type { ColonyFeed } from "@/lib/useColonyFeed";
import { CLOCK_ADAPTER, buildCycles, clockStatus, cycleBounds, formatGameDate, pluralDays } from "@/shared/clock";
import { WEATHER_ADAPTERS, weatherPeriods } from "@/shared/weather";

/** Signals that move the date: a new day, or a new cycle (temperate starting). */
export function useDateVersion(feed: ColonyFeed) {
  return useMemo(
    () => feed.live.filter((e) => e.state && (e.adapter_name === CLOCK_ADAPTER || e.adapter_name === "WeatherTemperate")).length,
    [feed.live],
  );
}

const CYCLE_ROWS = 8;
/** Enough weather signals (2 per change, 2 changes per cycle) for CYCLE_ROWS cycles plus slack. */
const CYCLE_SIGNALS = CYCLE_ROWS * 4 + 4;
/** "Still going" bound for day counts; a fixed value keeps the query from changing every tick. */
const OPEN_END = Date.UTC(2100, 0, 1);

export function GameClockCard({
  colonyId,
  feed,
  date,
  onDateSet,
}: {
  colonyId: string;
  feed: ColonyFeed;
  /** undefined while loading, null if the colony has no clock */
  date: GameDate | null | undefined;
  onDateSet: () => void;
}) {
  const now = useNow(15_000);
  const status = date ? clockStatus(date.last_day_at, date.seconds_per_day, now) : undefined;
  const label = date ? formatGameDate(date.cycle, date.day) : "";

  return (
    <article className="rounded-2xl border bg-paper p-5 sm:p-6">
      <header className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Game clock</h2>
        <div className="ml-auto flex items-center gap-1">
          {date && (
            <SetDateDialog colonyId={colonyId} current={{ cycle: date.cycle, day: date.day }} onSet={onDateSet}>
              <Button variant="ghost" size="sm" className="text-cobalt-deep hover:text-cobalt-deep">
                Set the date
              </Button>
            </SetDateDialog>
          )}
          <Button asChild variant="ghost" size="sm" className="text-cobalt-deep hover:text-cobalt-deep">
            <Link to="trackers/clock">Setup guide</Link>
          </Button>
        </div>
      </header>

      {date === undefined ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : date === null ? (
        <p className="mt-4 text-sm text-ink-soft">This colony has no game clock.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-pine text-mist" aria-hidden>
              <CalendarClock className="size-8" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <div className="relative h-10 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={label}
                    initial={{ y: 28, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -28, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 240, damping: 24 }}
                    className="font-display text-3xl leading-10 font-bold tracking-tight whitespace-nowrap"
                  >
                    {label}
                  </motion.div>
                </AnimatePresence>
              </div>
              <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
                {status?.kind === "running" ? (
                  <>
                    <StatusDot state live className="size-2" /> Running
                  </>
                ) : status?.kind === "stopped" ? (
                  <>
                    <StatusDot state={false} className="size-2" /> Paused or closed since {formatTime(status.since, now)}
                  </>
                ) : (
                  <>
                    <StatusDot state={undefined} live className="size-2" /> Waiting for the first day to pass
                  </>
                )}
              </p>
            </div>
          </div>

          {date.cycles_tracked ? (
            <CycleLog
              colonyId={colonyId}
              feed={feed}
              currentCycle={date.cycle}
              clockFrom={date.first_day_at ? Date.parse(date.first_day_at) : undefined}
            />
          ) : (
            <p className="mt-6 rounded-lg bg-resin-soft/60 px-3 py-2 text-sm text-ink">
              Add weather tracking so the cycle moves on when temperate weather starts. Until then, only the day counts up.
            </p>
          )}
        </>
      )}
    </article>
  );
}

/** Recent cycles with their length in game days, for the cycles the clock has counted. */
function CycleLog({
  colonyId,
  feed,
  currentCycle,
  clockFrom,
}: {
  colonyId: string;
  feed: ColonyFeed;
  currentCycle: number;
  clockFrom: number | undefined;
}) {
  const recent = useRecentSignals(colonyId, feed.live, CYCLE_SIGNALS, WEATHER_ADAPTERS);
  const version = useDateVersion(feed);

  const cycles = useMemo(() => {
    if (!recent || clockFrom === undefined) return [];
    const periods = weatherPeriods([...recent].reverse());
    // The oldest period may be cut off by the fetch limit; don't build a cycle from it.
    const complete = recent.length === CYCLE_SIGNALS ? periods.slice(1) : periods;
    // Only cycles that started after the clock's first day signal can be counted in game days.
    return buildCycles(complete, currentCycle)
      .filter((c) => c.start >= clockFrom)
      .slice(-CYCLE_ROWS);
  }, [recent, currentCycle, clockFrom]);

  const bounds = useMemo(() => (cycles.length ? cycleBounds(cycles, OPEN_END) : undefined), [cycles]);
  const counts = useDayCounts(colonyId, bounds, version);

  if (!recent || clockFrom === undefined) return null;

  // counts[i] are the days between bounds[i] and bounds[i + 1]; walk them per cycle.
  let k = 0;
  const rows = cycles.map((c) => {
    const temperate = counts?.[k++];
    const hazard = c.hazardStart !== null ? counts?.[k++] : undefined;
    return { cycle: c, temperate, hazard };
  });

  return (
    <section className="mt-6 border-t pt-4">
      <h3 className="text-sm font-medium">Cycles</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Cycles show up here once a new one starts with the clock running.</p>
      ) : (
        <ol className="mt-2 divide-y">
          {[...rows].reverse().map(({ cycle, temperate, hazard }) => {
            const ongoing = cycle.end === null;
            const total = temperate !== undefined ? temperate + (hazard ?? 0) : undefined;
            return (
              <li key={cycle.start} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 font-medium tabular-nums">Cycle {cycle.number.toLocaleString()}</span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-ink-soft">
                  <span className="inline-flex items-center gap-1.5">
                    <WeatherBadge weather="temperate" size="sm" />
                    {temperate !== undefined ? pluralDays(temperate) : "…"}
                  </span>
                  {cycle.hazard && (
                    <span className="inline-flex items-center gap-1.5">
                      <WeatherBadge weather={cycle.hazard} size="sm" />
                      {hazard !== undefined ? pluralDays(hazard) : "…"}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right font-medium tabular-nums">
                  {total !== undefined ? (ongoing ? `${pluralDays(total)} so far` : pluralDays(total)) : ""}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
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
