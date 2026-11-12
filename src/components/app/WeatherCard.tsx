import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { StatusDot } from "@/components/app/StatusDot";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART_BUCKET_SECONDS, useRecentSignals, useWeatherSlots } from "@/lib/history";
import { useDayCounts, useGameDayWindowStart } from "@/lib/clock";
import { pluralDays } from "@/shared/clock";
import { formatDay, formatTime, timeAgo } from "@/lib/time";
import { HISTORY_DAYS, type ColonyFeed } from "@/lib/useColonyFeed";
import { useWeatherCounts } from "@/lib/useWeatherCounts";
import { WEATHERS, WEATHER_ADAPTERS, currentWeather, formatDuration, gameDaySegments, periodEnd, periodsFromSlots, weatherForAdapter, weatherInfo, weatherPeriods } from "@/shared/weather";
import { WeatherBadge } from "./weather";
import { GameDayTimeline, type DaySegment } from "./GameDayTimeline";
import { WeatherTimeline } from "./WeatherTimeline";

const LOG_ROWS = 8;
/** "Still going" upper bound for day counts; a fixed value keeps the query from changing every tick. */
const OPEN_END = Date.UTC(2100, 0, 1);
/** Recent weather signals (2 per change): enough for the log and ~9 cycles of game-day strip. */
const LOG_SIGNALS = 80;
/** With a game clock, the strip shows this many game days. */
const GAME_DAY_WINDOW = 180;

export function WeatherCard({
  colonyId,
  feed,
  clockFrom,
  dayVersion,
}: {
  colonyId: string;
  feed: ColonyFeed;
  /** When the game clock's first day signal arrived; periods after it are measured in game days. */
  clockFrom?: number;
  dayVersion?: number;
}) {
  const now = useNow(30_000);
  const current = useMemo(() => currentWeather(feed.states.values()), [feed.states]);
  const gameDays = clockFrom !== undefined;
  // Real-time strip (no game clock): the dominant weather per chart slot, summarised in the database.
  const slots = useWeatherSlots(colonyId, WEATHER_ADAPTERS, CHART_BUCKET_SECONDS, !gameDays);
  // Exact recent periods from the latest weather signals: the log, and the game-day strip.
  const recent = useRecentSignals(colonyId, feed.live, LOG_SIGNALS, WEATHER_ADAPTERS);
  const recentPeriods = useMemo(() => {
    if (!recent) return [];
    const periods = weatherPeriods([...recent].reverse());
    // The oldest period may be cut off by the fetch limit, so don't trust where it starts.
    return recent.length === LOG_SIGNALS ? periods.slice(1) : periods;
  }, [recent]);
  const log = useMemo(() => recentPeriods.slice(-LOG_ROWS).reverse(), [recentPeriods]);

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
  const currentDays = current.kind === "known" && !current.ended && log[0] ? daysOf(log[0]) : undefined;

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

  return (
    <article className="rounded-2xl border bg-paper p-5 sm:p-6">
      <header className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Weather</h2>
        <Button asChild variant="ghost" size="sm" className="ml-auto text-cobalt-deep hover:text-cobalt-deep">
          <Link to="/colonies/$id/trackers/weather" params={{ id: colonyId }}>Setup guide</Link>
        </Button>
      </header>

      <div className="mt-4 min-h-16">
        {feed.loading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-2xl" />
            <Skeleton className="h-8 w-40" />
          </div>
        ) : current.kind === "waiting" ? (
          <div>
            <div className="flex items-center gap-2.5 text-sm text-ink-soft">
              <StatusDot state={undefined} live className="size-2" /> Listening
            </div>
            <p className="mt-2 font-display text-xl leading-tight font-semibold">Waiting for the first weather signal</p>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-soft">
              Weather Stations report when the weather changes. The setup guide shows how to make the current weather
              report now.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={current.weather}
                initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <WeatherBadge weather={current.weather} size="lg" />
              </motion.div>
            </AnimatePresence>
            <div className="min-w-0">
              <div className="font-display text-3xl leading-tight font-bold tracking-tight">
                {weatherInfo(current.weather).label}
              </div>
              <p className="text-sm text-ink-soft">
                {current.ended
                  ? `Ended ${timeAgo(current.since, now)}. Waiting for the next weather.`
                  : currentDays
                    ? `Day ${currentDays} of this ${weatherInfo(current.weather).label.toLowerCase()}`
                    : `Started ${timeAgo(current.since, now)}`}
              </p>
            </div>
          </div>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-2">
        {WEATHERS.map((w) => (
          <div key={w.key} className="rounded-xl bg-mist-2/60 p-3">
            <dt className="flex items-center gap-2 text-sm">
              <WeatherBadge weather={w.key} size="sm" />
              <span className="truncate">{w.label}</span>
            </dt>
            <dd className="mt-2 font-display text-2xl leading-none font-bold tabular-nums">
              {counts ? counts[w.key] : <Skeleton className="h-6 w-8" />}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-soft">How many times each weather has started.</p>

      {(timeline.length > 0 || log.length > 0) && (
        <>
          <div className="mt-6 border-t pt-4">
            {gameDays ? (
              <>
                <div className="mb-2 text-sm text-ink-soft">
                  {windowDays >= GAME_DAY_WINDOW ? `Last ${GAME_DAY_WINDOW} game days` : "Since the game clock started"}
                </div>
                {daySegments ? <GameDayTimeline segments={daySegments} totalDays={windowDays} /> : <Skeleton className="h-4 w-full" />}
              </>
            ) : (
              <>
                <div className="mb-2 text-sm text-ink-soft">Last {HISTORY_DAYS} days</div>
                <WeatherTimeline periods={timeline} now={now} />
              </>
            )}
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-medium">Log</h3>
            <ol className="mt-2 divide-y">
              <AnimatePresence initial={false}>
                {log.map((p) => (
                  <motion.li
                    key={`${p.weather}-${p.start}`}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 py-2 text-sm"
                  >
                    <WeatherBadge weather={p.weather} size="sm" />
                    <span className="w-20 shrink-0 font-medium">{weatherInfo(p.weather).label}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-soft">
                      {p.carried ? `Before ${formatDay(p.start)}` : formatTime(p.start)}
                    </span>
                    <span className="shrink-0 text-right text-ink-soft tabular-nums">
                      {(() => {
                        const days = daysOf(p);
                        if (days !== undefined && days > 0) return p.end || p.offAt ? pluralDays(days) : `${pluralDays(days)} so far`;
                        return (
                          <>
                            {p.carried && "over "}
                            {p.end
                              ? formatDuration(periodEnd(p)! - p.start)
                              : p.offAt
                                ? `ended ${timeAgo(p.offAt, now)}`
                                : `${formatDuration(now - p.start)} so far`}
                          </>
                        );
                      })()}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </div>
        </>
      )}
    </article>
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
