import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { PublicPage } from "@/components/PublicPage";
import { WeatherBadge } from "@/components/app/weather";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useColonyLadder, type LadderEntry } from "@/lib/ladder";
import { timeAgo } from "@/lib/time";
import { formatGameDate } from "@/shared/clock";
import { factionLabel } from "@/shared/goods";
import { formatValue } from "@/shared/ladders";
import { weatherInfo } from "@/shared/weather";

export function Ladder() {
  const { session } = useAuth();
  const { data: entries, isError } = useColonyLadder();

  return (
    <PublicPage
      title="Colony ladder"
      intro="Colonies being played right now. The colony that most recently started a new cycle is on top, so the order shifts each time temperate weather returns somewhere. A colony is listed while its game has sent a signal in the last hour, and only if its player made their profile public."
    >
      <div className="mt-10">
        {isError ? (
          <p className="text-ink-soft">The ladder couldn't be loaded. Try again in a moment.</p>
        ) : entries === undefined ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="max-w-2xl rounded-2xl border border-dashed border-ink/20 p-8">
            <h2 className="text-2xl font-bold tracking-tight">No colonies on the ladder right now</h2>
            <p className="mt-3 leading-relaxed text-ink-soft">
              Colonies appear here while they're being played. Check back later, or put yours here.
            </p>
          </div>
        ) : (
          <ol className="space-y-2">
            {/* Rows slide to their new place when the order changes, and fade in or out as colonies come and go. */}
            <AnimatePresence initial={false} mode="popLayout">
              {entries.map((e, i) => (
                <Entry key={e.key} entry={e} rank={i + 1} />
              ))}
            </AnimatePresence>
          </ol>
        )}

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Want your colony here?{" "}
          <Link to={session ? "/account" : "/login"} className="text-cobalt-deep underline-offset-4 hover:underline">
            {session ? "Make your profile public" : "Sign in and make your profile public"}
          </Link>
          . Numbers come from each colony's own counters, so they are as exact as the player set them up.
          The list refreshes by itself.
        </p>
      </div>
    </PublicPage>
  );
}

function Entry({ entry, rank, ref }: { entry: LadderEntry; rank: number; ref?: React.Ref<HTMLLIElement> }) {
  const faction = factionLabel(entry.faction);

  // A row lights up briefly when its colony starts a new cycle, which is also what moves it to the top.
  const stamp = entry.cycleStartedAt ?? undefined;
  const lastStamp = useRef(stamp);
  const moved = stamp !== undefined && lastStamp.current !== undefined && stamp > lastStamp.current;
  useEffect(() => {
    lastStamp.current = stamp;
  }, [stamp]);

  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ layout: { type: "spring", stiffness: 260, damping: 30 }, duration: 0.25 }}
      className="relative flex flex-wrap items-center gap-x-6 gap-y-3 overflow-hidden rounded-2xl border bg-paper px-5 py-4"
    >
      {moved && (
        <motion.span
          key={stamp}
          aria-hidden
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 bg-resin-soft"
        />
      )}
      <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden font-display text-2xl font-bold text-ink-soft tabular-nums" aria-label={`Place ${rank}`}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={rank} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }} transition={{ duration: 0.25 }}>
            {rank}
          </motion.span>
        </AnimatePresence>
      </span>
      <div className="relative min-w-0 flex-1 basis-56">
        <div className="truncate font-display text-xl leading-tight font-semibold">{entry.colonyName}</div>
        <div className="mt-0.5 truncate text-sm text-ink-soft">
          {entry.handle}
          {faction && <> · {faction}</>}
          {entry.cycleStartedAt ? <> · new cycle {timeAgo(entry.cycleStartedAt)}</> : <> · active {timeAgo(entry.lastSignalAt)}</>}
        </div>
      </div>
      <dl className="relative flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
        <Stat label="Population">
          {entry.population ? <span className="font-display text-xl font-bold tabular-nums">{formatValue(entry.population)}</span> : <Missing />}
        </Stat>
        <Stat label="Game date">{entry.date ? formatGameDate(entry.date.cycle, entry.date.day) : <Missing />}</Stat>
        <Stat label="Weather">
          {entry.weather ? (
            <span className="inline-flex items-center gap-2">
              <WeatherBadge weather={entry.weather} size="sm" /> {weatherInfo(entry.weather).label}
            </span>
          ) : (
            <Missing />
          )}
        </Stat>
      </dl>
    </motion.li>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-24">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5 flex min-h-7 items-center">{children}</dd>
    </div>
  );
}

const Missing = () => (
  <span className="text-ink-soft" title="This colony doesn't track it">
    <span aria-hidden>–</span>
    <span className="sr-only">Not tracked</span>
  </span>
);
