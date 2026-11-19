import { CalendarClock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { StatusDot } from "@/components/app/StatusDot";
import { WeatherBadge } from "@/components/app/weather";
import { useDayCounts, type GameDate } from "@/lib/clock";
import { isReporting, type ModStatus } from "@/lib/readings";
import { formatTime, timeAgo } from "@/lib/time";
import type { ColonyFeed } from "@/lib/useColonyFeed";
import { clockStatus, formatGameDate } from "@/shared/clock";
import { currentWeather, weatherInfo } from "@/shared/weather";

/** "Still going" bound for day counts; a fixed value keeps the query from changing every tick. */
const OPEN_END = Date.UTC(2100, 0, 1);

/**
 * The strip at the top of the colony page that answers three questions at a glance: what is the
 * game date, what is the weather, and is the game sending right now. A part the colony has no
 * data for is left out; the status line is always there. Pinned while scrolling on wide screens.
 */
export function StatusBand({
  colonyId,
  feed,
  date,
  mod,
  lastSignal,
  dayVersion,
}: {
  colonyId: string;
  /** The colony's feed with the companion mod's weather and date folded in. */
  feed: ColonyFeed;
  /** undefined while loading, null if the colony has no game date. */
  date: GameDate | null | undefined;
  /** undefined while loading, null if the mod has never reported. */
  mod: ModStatus | null | undefined;
  /** When the latest adapter signal arrived. */
  lastSignal: string | undefined;
  dayVersion: number;
}) {
  const now = useNow(15_000);
  const weather = useMemo(() => currentWeather(feed.states.values()), [feed.states]);
  // How many game days the current weather has lasted, if the clock was running when it started.
  const clockFrom = date?.first_day_at ? Date.parse(date.first_day_at) : undefined;
  const since = weather.kind === "known" && !weather.ended ? weather.since : undefined;
  const bounds = useMemo(() => (since !== undefined && clockFrom !== undefined && since >= clockFrom ? [since, OPEN_END] : undefined), [since, clockFrom]);
  const weatherDays = useDayCounts(colonyId, bounds, dayVersion)?.[0];

  // One answer to "is my game sending right now?": the mod, then the clock, then when it stopped.
  const clock = date ? clockStatus(date.last_day_at, date.seconds_per_day, now) : undefined;
  const lastSeen = Math.max(mod?.lastSeen ?? 0, lastSignal ? Date.parse(lastSignal) : 0, clock?.kind === "stopped" ? clock.since : 0);
  const status = isReporting(mod, now)
    ? { live: true, text: "Reporting" }
    : clock?.kind === "running"
      ? { live: true, text: "Running" }
      : lastSeen
        ? { live: false, text: `Paused or closed since ${formatTime(lastSeen, now)}` }
        : { live: false, text: "Nothing received yet. Connect an adapter or the companion mod to get started." };

  const label = date ? formatGameDate(date.cycle, date.day) : undefined;
  const loading = feed.loading || date === undefined || mod === undefined;

  return (
    <section aria-label="Colony status" className="mt-6 rounded-2xl bg-pine px-5 py-4 text-mist lg:sticky lg:top-3 lg:z-20 lg:px-6 lg:py-5 lg:shadow-sm">
      <div className="flex flex-col gap-x-8 gap-y-3 lg:flex-row lg:items-center">
        {(label || weather.kind === "known") && (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {label && (
              <div className="flex items-center gap-3 font-display text-3xl leading-none font-bold tracking-tight lg:text-4xl">
                <CalendarClock className="size-7 shrink-0 text-sage lg:size-8" strokeWidth={1.75} aria-hidden />
                <span className="relative block h-[1.1em] overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={label}
                      initial={{ y: 28, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -28, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 240, damping: 24 }}
                      className="block leading-[1.1] whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>
            )}
            {weather.kind === "known" && (
              <div className="flex items-center gap-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={weather.weather}
                    initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  >
                    <WeatherBadge weather={weather.weather} size="md" className="lg:size-14 lg:rounded-xl lg:[&_svg]:size-8" />
                  </motion.div>
                </AnimatePresence>
                <div className="leading-tight">
                  <div className="font-display text-xl font-bold tracking-tight">{weatherInfo(weather.weather).label}</div>
                  <div className="text-sm text-sage">
                    {weather.ended
                      ? `Ended ${timeAgo(weather.since, now)}`
                      : weatherDays
                        ? `Day ${weatherDays} of this ${weatherInfo(weather.weather).label.toLowerCase()}`
                        : `Started ${timeAgo(weather.since, now)}`}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <p className={`flex min-h-5 items-center gap-2.5 text-sm lg:ml-auto ${status.live ? "font-medium" : "text-sage"}`}>
          {!loading && (
            <>
              <StatusDot state={lastSeen ? status.live : undefined} live={status.live} className={status.live ? undefined : lastSeen ? "bg-sage/50" : "border-sage"} />
              {status.text}
            </>
          )}
        </p>
      </div>
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
