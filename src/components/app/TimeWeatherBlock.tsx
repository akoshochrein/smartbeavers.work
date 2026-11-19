import { Ellipsis } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SetDateDialog } from "@/components/app/SetDateDialog";
import { StatusDot } from "@/components/app/StatusDot";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART_BUCKET_SECONDS, useRecentSignals, useWeatherSlots } from "@/lib/history";
import { useDayCounts, useGameDayWindowStart, type GameDate } from "@/lib/clock";
import { CLOCK_ADAPTER, buildCycles, cycleBounds, pluralDays } from "@/shared/clock";
import { formatDay, formatTime, timeAgo } from "@/lib/time";
import { HISTORY_DAYS, type ColonyFeed } from "@/lib/useColonyFeed";
import { useWeatherCounts } from "@/lib/useWeatherCounts";
import { WEATHERS, WEATHER_ADAPTERS, currentWeather, formatDuration, gameDaySegments, periodEnd, periodsFromSlots, weatherForAdapter, weatherInfo, weatherPeriods } from "@/shared/weather";
import { WeatherBadge } from "./weather";
import { GameDayTimeline, type DaySegment } from "./GameDayTimeline";
import { WeatherTimeline } from "./WeatherTimeline";

/** The weather log shows this many periods until "show more" is pressed. */
const LOG_ROWS = 5;
const LOG_MAX = 20;
/** "Still going" upper bound for day counts; a fixed value keeps the query from changing every tick. */
const OPEN_END = Date.UTC(2100, 0, 1);
/** Recent weather signals (2 per change): enough for the log and ~9 cycles of game-day strip. */
const LOG_SIGNALS = 80;
/** With a game clock, the strip shows this many game days. */
const GAME_DAY_WINDOW = 180;
const CYCLE_ROWS = 8;
/** Enough weather signals (2 per change, 2 changes per cycle) for CYCLE_ROWS cycles plus slack. */
const CYCLE_SIGNALS = CYCLE_ROWS * 4 + 4;

/** Signals that move the date: a new day, or a new cycle (temperate starting). */
export function useDateVersion(feed: ColonyFeed) {
  return useMemo(
    () => feed.live.filter((e) => e.state && (e.adapter_name === CLOCK_ADAPTER || e.adapter_name === "WeatherTemperate")).length,
    [feed.live],
  );
}

/**
 * The history behind the status band, in one block: the weather timeline, how many times each
 * weather has started, the recent cycles and the weather log. A colony with only a game clock or
 * only weather shows just that half. The date and the current weather themselves are on the band.
 */
export function TimeWeatherBlock({
  colonyId,
  feed,
  date,
  clock,
  weather,
  clockAuto = false,
  weatherAuto = false,
  dayVersion,
  onDateSet,
}: {
  colonyId: string;
  /** The colony's feed with the companion mod's weather and date folded in. */
  feed: ColonyFeed;
  /** undefined while loading, null if the colony has no game date. */
  date: GameDate | null | undefined;
  /** The colony has a game date, from a game clock or the companion mod. */
  clock: boolean;
  /** The colony follows the weather, through stations or the companion mod. */
  weather: boolean;
  /** The date comes from the companion mod: there is no clock to set and no guide to follow. */
  clockAuto?: boolean;
  /** The weather comes from the companion mod, not from stations the player set up. */
  weatherAuto?: boolean;
  dayVersion?: number;
  onDateSet: () => void;
}) {
  const clockFrom = date?.first_day_at ? Date.parse(date.first_day_at) : undefined;
  const [settingDate, setSettingDate] = useState(false);
  const [allLog, setAllLog] = useState(false);
  const now = useNow(30_000);
  const current = useMemo(() => currentWeather(feed.states.values()), [feed.states]);
  const gameDays = clockFrom !== undefined;
  // Real-time strip (no game clock): the dominant weather per chart slot, summarised in the database.
  const slots = useWeatherSlots(colonyId, WEATHER_ADAPTERS, CHART_BUCKET_SECONDS, weather && !gameDays);
  // Exact recent periods from the latest weather signals: the log, and the game-day strip.
  const recent = useRecentSignals(colonyId, feed.live, LOG_SIGNALS, WEATHER_ADAPTERS);
  const recentPeriods = useMemo(() => {
    if (!recent) return [];
    const periods = weatherPeriods([...recent].reverse());
    // The oldest period may be cut off by the fetch limit, so don't trust where it starts.
    return recent.length === LOG_SIGNALS ? periods.slice(1) : periods;
  }, [recent]);
  const log = useMemo(() => recentPeriods.slice(-LOG_MAX).reverse(), [recentPeriods]);

  // Game-day strip: the last GAME_DAY_WINDOW game days, each weather as wide as its game days.
  const windowStart = useGameDayWindowStart(colonyId, GAME_DAY_WINDOW, clockFrom, dayVersion);
  const segmentPlan = useMemo(
    () => (gameDays && windowStart ? gameDaySegments(recentPeriods, windowStart, OPEN_END) : undefined),
    [gameDays, windowStart, recentPeriods],
  );
  const segmentDays = useDayCounts(colonyId, segmentPlan?.bounds, dayVersion);
  const daySegments: DaySegment[] | undefined =
    segmentPlan && segmentDays
      ? segmentPlan.weathers.map((weather, i) => ({ weather, days: segmentDays[i] ?? 0, ongoing: i === segmentPlan.weathers.length - 1 }))
      : undefined;
  const windowDays = daySegments?.reduce((n, s) => n + s.days, 0) ?? 0;
  // Game days per log period (only periods the clock was running for), counted in the database.
  const counted = useMemo(() => (clockFrom === undefined ? [] : log.filter((p) => p.start >= clockFrom)), [log, clockFrom]);
  const bounds = useMemo(
    () => (counted.length ? counted.flatMap((p) => [p.start, periodEnd(p) ?? OPEN_END]) : undefined),
    [counted],
  );
  const dayCounts = useDayCounts(colonyId, bounds, dayVersion);
  const daysOf = (p: (typeof log)[number]) => {
    const i = counted.indexOf(p);
    return i >= 0 && dayCounts ? dayCounts[i * 2] : undefined;
  };

  const timeline = useMemo(() => {
    if (!slots) return [];
    const periods = periodsFromSlots(slots, CHART_BUCKET_SECONDS * 1000, now);
    // Live changes after the summary was loaded extend the strip.
    const lastSlot = slots.length ? Date.parse(slots[slots.length - 1].slot_start) : 0;
    const liveOn = feed.live.filter((e) => e.state && weatherForAdapter(e.adapter_name) && Date.parse(e.received_at) > lastSlot);
    for (const e of liveOn) {
      const tail = periods[periods.length - 1];
      const t = Date.parse(e.received_at);
      if (tail && tail.end === null) tail.end = t;
      periods.push({ weather: weatherForAdapter(e.adapter_name)!.key, start: t, end: null, offAt: null, carried: false });
    }
    return periods;
  }, [slots, feed.live, now]);
  const weatherSignals = useMemo(() => feed.live.filter((e) => weatherForAdapter(e.adapter_name)).length, [feed.live]);
  const counts = useWeatherCounts(colonyId, weatherSignals);

  const shownLog = allLog ? log : log.slice(0, LOG_ROWS);
  const canSetDate = clock && !clockAuto && !!date;
  const guides = [
    clock && !clockAuto && { to: "/colonies/$id/trackers/clock" as const, label: "Game clock setup guide" },
    weather && !weatherAuto && { to: "/colonies/$id/trackers/weather" as const, label: "Weather setup guide" },
  ].filter((g) => !!g);
  const waiting = weather && !feed.loading && current.kind === "waiting";
  const hasTimeline = weather && (timeline.length > 0 || log.length > 0);

  return (
    <article className="relative space-y-6 rounded-2xl border bg-paper p-5 sm:p-6">
      {(canSetDate || guides.length > 0) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3 text-ink-soft" aria-label="Set the date and setup guides">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canSetDate && <DropdownMenuItem onSelect={() => setSettingDate(true)}>Set the date</DropdownMenuItem>}
            {guides.map((g) => (
              <DropdownMenuItem key={g.to} asChild>
                <Link to={g.to} params={{ id: colonyId }}>
                  {g.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {date && <SetDateDialog colonyId={colonyId} current={{ cycle: date.cycle, day: date.day }} onSet={onDateSet} open={settingDate} onOpenChange={setSettingDate} />}

      {waiting && (
        <div className="pr-8">
          <div className="flex items-center gap-2.5 text-sm text-ink-soft">
            <StatusDot state={undefined} live className="size-2" /> Listening
          </div>
          <p className="mt-2 font-display text-xl leading-tight font-semibold">Waiting for the first weather signal</p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-soft">
            Weather Stations report when the weather changes. The setup guide shows how to make the current weather report now.
          </p>
        </div>
      )}

      {hasTimeline && (
        <div>
          <div className="mb-2 pr-8 text-sm text-ink-soft">
            {!gameDays ? `Last ${HISTORY_DAYS} days` : windowDays >= GAME_DAY_WINDOW ? `Last ${GAME_DAY_WINDOW} game days` : "Since the game clock started"}
          </div>
          {!gameDays ? <WeatherTimeline periods={timeline} now={now} /> : daySegments ? <GameDayTimeline segments={daySegments} totalDays={windowDays} /> : <Skeleton className="h-4 w-full" />}
        </div>
      )}

      {weather && (
        <div className={hasTimeline || waiting ? undefined : "pr-8"}>
          <h3 className="text-sm font-medium">Weather so far</h3>
          <dl className="mt-2 grid grid-cols-3 gap-2">
            {WEATHERS.map((w) => (
              <div key={w.key} className="rounded-xl bg-mist-2/60 p-3">
                <dt className="flex flex-col gap-1.5 text-sm">
                  <WeatherBadge weather={w.key} size="sm" />
                  {w.label}
                </dt>
                <dd className="mt-2 font-display text-2xl leading-none font-bold tabular-nums">{counts ? counts[w.key] : <Skeleton className="h-6 w-8" />}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-ink-soft">How many times each weather has started.</p>
        </div>
      )}

      {clock &&
        (date === undefined ? (
          <Skeleton className="h-10 w-full" />
        ) : date === null ? (
          <p className="pr-8 text-sm text-ink-soft">This colony has no game clock.</p>
        ) : date.cycles_tracked ? (
          <CycleLog colonyId={colonyId} feed={feed} currentCycle={date.cycle} clockFrom={clockFrom} />
        ) : (
          <p className="rounded-lg bg-resin-soft/60 px-3 py-2 text-sm text-ink">
            Add weather tracking so the cycle moves on when temperate weather starts. Until then, only the day counts up.
          </p>
        ))}

      {weather && log.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Weather log</h3>
          <ol className="mt-2 divide-y">
            <AnimatePresence initial={false}>
              {shownLog.map((p) => (
                <motion.li key={`${p.weather}-${p.start}`} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 py-2 text-sm">
                  <WeatherBadge weather={p.weather} size="sm" />
                  <span className="w-20 shrink-0 font-medium">{weatherInfo(p.weather).label}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-soft">{p.carried ? `Before ${formatDay(p.start)}` : formatTime(p.start)}</span>
                  <span className="shrink-0 text-right text-ink-soft tabular-nums">
                    {(() => {
                      const days = daysOf(p);
                      if (days !== undefined && days > 0) return p.end || p.offAt ? pluralDays(days) : `${pluralDays(days)} so far`;
                      return (
                        <>
                          {p.carried && "over "}
                          {p.end ? formatDuration(periodEnd(p)! - p.start) : p.offAt ? `ended ${timeAgo(p.offAt, now)}` : `${formatDuration(now - p.start)} so far`}
                        </>
                      );
                    })()}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          {log.length > LOG_ROWS && (
            <Button variant="link" size="sm" className="mt-1 px-0 text-cobalt-deep" aria-expanded={allLog} onClick={() => setAllLog(!allLog)}>
              {allLog ? "Show fewer" : `Show ${log.length - LOG_ROWS} more`}
            </Button>
          )}
        </div>
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
    <section>
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
