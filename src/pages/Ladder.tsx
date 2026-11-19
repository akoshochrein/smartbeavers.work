import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { PublicPage } from "@/components/PublicPage";
import { Avatar } from "@/components/app/Avatar";
import { FactionPill, factionLook, factionPanelStyle } from "@/components/app/faction";
import { StatusDot } from "@/components/app/StatusDot";
import { WeatherBadge } from "@/components/app/weather";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { LIVE_MS, useColonyLadder, type LadderEntry } from "@/lib/ladder";
import { useStoredPicture } from "@/lib/profile";
import { timeAgo } from "@/lib/time";
import { formatGameDate } from "@/shared/clock";
import { formatValue } from "@/shared/ladders";
import { weatherInfo } from "@/shared/weather";

/**
 * The live colonies page: how other players' colonies are doing. Not a ranking. Colonies being
 * played now are wide strips in their faction's look; colonies played in the last 7 days follow
 * as a quieter table. Both are ordered by when they were last heard from.
 */
export function Ladder() {
  const { session } = useAuth();
  const { data: entries, isError, dataUpdatedAt } = useColonyLadder();
  // Which colonies are live is judged against when the list was last fetched (every 20 seconds).
  const now = dataUpdatedAt || Date.now();
  const live = entries?.filter((e) => now - e.lastSignalAt < LIVE_MS) ?? [];
  const recent = entries?.filter((e) => now - e.lastSignalAt >= LIVE_MS) ?? [];

  return (
    <PublicPage
      wide
      title="Live colonies"
      intro="See how other players' colonies are doing. Colonies being played right now come first; the rest were played in the last 7 days. A colony is listed only if its player made their profile public."
    >
      {isError ? (
        <p className="mt-10 text-ink-soft">The list couldn't be loaded. Try again in a moment.</p>
      ) : entries === undefined ? (
        <div className="mt-10 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-10 max-w-2xl rounded-2xl border border-dashed border-ink/20 p-8">
          <h2 className="text-2xl font-bold tracking-tight">No colonies played in the last 7 days</h2>
          <p className="mt-3 leading-relaxed text-ink-soft">Colonies appear here while they're being played and stay for a week afterwards. Check back later, or put yours here.</p>
        </div>
      ) : (
        <>
          <Group title="Live now" note={live.length === 0 ? "Nobody is playing right now." : `${live.length} being played`}>
            {live.length > 0 && (
              <ol className="space-y-3">
                {/* Strips slide to their new place when the order changes, and fade in or out as colonies come and go. */}
                <AnimatePresence initial={false} mode="popLayout">
                  {live.map((e) => (
                    <LiveStrip key={e.key} entry={e} />
                  ))}
                </AnimatePresence>
              </ol>
            )}
          </Group>
          {recent.length > 0 && (
            <Group title="Recently played" note="In the last 7 days">
              <ol className="divide-y overflow-hidden rounded-2xl border bg-paper">
                <AnimatePresence initial={false} mode="popLayout">
                  {recent.map((e) => (
                    <RecentRow key={e.key} entry={e} now={now} />
                  ))}
                </AnimatePresence>
              </ol>
            </Group>
          )}
        </>
      )}

      <p className="mt-10 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Want your colony here?{" "}
        <Link to={session ? "/account" : "/login"} className="text-cobalt-deep underline-offset-4 hover:underline">
          {session ? "Make your profile public" : "Sign in and make your profile public"}
        </Link>
        . That lists your colonies here. To let people open one, also switch on "Show this colony's page publicly" in that colony's settings.
        Numbers come from each colony's own counters or the companion mod, so they are as exact as the player set them up. The list refreshes by
        itself.
      </p>
    </PublicPage>
  );
}

function Group({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-4">
        <h2 className="text-sm font-semibold tracking-wide text-ink-soft uppercase">{title}</h2>
        <p className="text-sm text-ink-soft">{note}</p>
      </div>
      {children}
    </section>
  );
}

const SLIDE = { layout: { type: "spring", stiffness: 260, damping: 30 }, duration: 0.25 } as const;

/** A value that rolls to its new text when it changes. */
function Rolling({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`relative block overflow-hidden ${className ?? ""}`}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={text} initial={{ y: 22, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -22, opacity: 0 }} transition={{ duration: 0.25 }} className="block whitespace-nowrap">
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * A public colony's strip or row is a link to its page, marked with an arrow. A colony that is
 * only listed gets a plain box: it looks complete as it is and doesn't respond.
 */
function Opens({ entry, className, children }: { entry: LadderEntry; className: string; children: ReactNode }) {
  if (!entry.slug) return <div className={className}>{children}</div>;
  return (
    <Link to="/live/$handle/$colony" params={{ handle: entry.handle, colony: entry.slug }} aria-label={`${entry.colonyName}, open this colony's page`} className={`group ${className} outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-cobalt`}>
      {children}
    </Link>
  );
}

const Arrow = ({ entry, className }: { entry: LadderEntry; className: string }) =>
  entry.slug ? <ChevronRight className={`${className} shrink-0 text-ink-soft transition-transform group-hover:translate-x-1`} aria-hidden /> : <span className={`${className} shrink-0`} aria-hidden />;

const NotTracked = () => <span className="text-base font-normal text-ink-soft">Not tracked</span>;

/** A colony being played now: its faction's panel with who it is, then date, weather and population. */
function LiveStrip({ entry, ref }: { entry: LadderEntry; ref?: React.Ref<HTMLLIElement> }) {
  const pictureUrl = useStoredPicture(entry.picture?.path, entry.picture?.version);
  const look = factionLook(entry.faction);

  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={SLIDE}
      className="overflow-hidden rounded-2xl border bg-paper transition-shadow has-[a:hover]:shadow-md"
    >
      <Opens entry={entry} className="block lg:grid lg:grid-cols-[20rem_1fr] xl:grid-cols-[24rem_1fr]">
      <div className="relative flex flex-col justify-between gap-4 p-5 pl-6" style={factionPanelStyle(entry.faction)}>
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: look.accent }} aria-hidden />
        <div className="min-w-0">
          <h3 className="truncate font-display text-2xl leading-tight font-bold">{entry.colonyName}</h3>
          <div className="mt-1.5 flex min-w-0 items-center gap-2 text-sm" style={{ color: look.sub }}>
            <Avatar url={pictureUrl} name={entry.handle} className="size-6 text-xs" />
            <span className="truncate">{entry.handle}</span>
            <FactionPill faction={entry.faction} />
          </div>
        </div>
        {/* On its own dark pill, so it reads on any faction's panel. */}
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-black/45 py-1 pr-3 pl-2.5 text-sm font-medium text-mist">
          <StatusDot state live className="size-2" /> Live
        </span>
      </div>

      <dl className="grid grid-cols-2 items-center gap-x-8 gap-y-4 p-5 sm:grid-cols-[14rem_12rem_1fr_auto] lg:px-8">
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-ink-soft">Game date</dt>
          <dd className="mt-1 font-display text-2xl leading-8 font-bold tracking-tight xl:text-3xl">
            {entry.date ? <Rolling text={formatGameDate(entry.date.cycle, entry.date.day)} className="h-8" /> : <NotTracked />}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Weather</dt>
          <dd className="mt-1">
            {entry.weather ? (
              <span className="flex items-center gap-2.5">
                <WeatherBadge weather={entry.weather} size="md" />
                <span className="leading-tight">
                  <span className="block font-display text-xl font-bold">{weatherInfo(entry.weather).label}</span>
                  {entry.weatherDays && <span className="block text-sm text-ink-soft">day {entry.weatherDays}</span>}
                </span>
              </span>
            ) : (
              <NotTracked />
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Population</dt>
          <dd className="mt-1">
            {entry.population ? (
              <span className="flex flex-wrap items-baseline gap-x-2">
                <Rolling text={formatValue(entry.population)} className="h-10 font-display text-4xl leading-10 font-bold tracking-tight tabular-nums" />
                <span className="text-sm text-ink-soft">beavers and bots</span>
              </span>
            ) : (
              <NotTracked />
            )}
          </dd>
        </div>
        <Arrow entry={entry} className="hidden size-6 sm:block" />
      </dl>
      </Opens>
    </motion.li>
  );
}

/** A colony played in the last 7 days: one quiet row, grey until it is hovered or focused. */
function RecentRow({ entry, now, ref }: { entry: LadderEntry; now: number; ref?: React.Ref<HTMLLIElement> }) {
  const pictureUrl = useStoredPicture(entry.picture?.path, entry.picture?.version);
  const look = factionLook(entry.faction);

  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SLIDE}
      className="bg-paper"
    >
      {/* The greying sits on an inner box: the row itself is animated, which sets its own opacity. */}
      <Opens entry={entry} className="relative flex flex-wrap items-center gap-x-6 gap-y-1 py-3 pr-5 pl-6 opacity-60 grayscale transition duration-200 focus-visible:opacity-100 focus-visible:grayscale-0 hover:opacity-100 hover:grayscale-0">
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: look.panel }} aria-hidden />
        <h3 className="w-full truncate font-display text-lg font-semibold sm:w-48">{entry.colonyName}</h3>
        <span className="flex w-64 min-w-0 items-center gap-2 text-sm text-ink-soft">
          <Avatar url={pictureUrl} name={entry.handle} className="size-6 text-xs" />
          <span className="truncate">{entry.handle}</span>
          <FactionPill faction={entry.faction} on="page" />
        </span>
        <span className="w-36 text-sm whitespace-nowrap">{entry.date ? formatGameDate(entry.date.cycle, entry.date.day) : ""}</span>
        <span className="flex w-28 items-center gap-2 text-sm">
          {entry.weather && (
            <>
              <WeatherBadge weather={entry.weather} size="sm" /> {weatherInfo(entry.weather).label}
            </>
          )}
        </span>
        <span className="w-24 font-display text-lg font-bold tabular-nums">{entry.population ? formatValue(entry.population) : ""}</span>
        <span className="ml-auto text-sm text-ink-soft">{timeAgo(entry.lastSignalAt, now)}</span>
        <Arrow entry={entry} className="size-4" />
      </Opens>
    </motion.li>
  );
}
