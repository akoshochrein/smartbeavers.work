import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { ValueChart } from "@/components/ValueChart";
import { SiteFooter } from "@/components/PublicPage";
import { Avatar } from "@/components/app/Avatar";
import { FactionPill, factionLook, factionPanelStyle } from "@/components/app/faction";
import { GameDayTimeline } from "@/components/app/GameDayTimeline";
import { GoodIcon } from "@/components/app/GoodIcon";
import { PopulationChart, POPULATION_BLOCK_METRICS, type PopulationSeries } from "@/components/app/PopulationBlock";
import { StatusBandView } from "@/components/app/StatusBand";
import { TileGrid, TrackerSections } from "@/components/app/TrackerSections";
import { TileShell } from "@/components/app/TrackerTile";
import { WeatherBadge } from "@/components/app/weather";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { LIVE_MS } from "@/lib/ladder";
import { useStoredPicture } from "@/lib/profile";
import { publicTimeline, usePublicColony, usePublicHistory, usePublicOverview, type PublicColony, type PublicNumber, type PublicOverview, type PublicPeriod } from "@/lib/publicColony";
import { timeAgo } from "@/lib/time";
import { formatGameDate, pluralDays } from "@/shared/clock";
import { formatValue, valueSuffix, type Value } from "@/shared/ladders";
import { WEATHERS, weatherInfo, type Weather } from "@/shared/weather";

const ROUTE = "/live_/$handle/$colony";
/** The weather log and the cycles list show this many entries until "show more" is pressed. */
const LOG_ROWS = 5;
const CYCLE_ROWS = 4;
const GAME_DAY_WINDOW = 180;

/**
 * A public colony, as anyone can see it: the same status band, time and weather, population and
 * goods its owner sees, read-only, with nothing about its signals or settings. Times are in game
 * days throughout; the one real time is when the colony was last heard from.
 */
export function PublicColonyPage() {
  const { handle, colony: slug } = useParams({ from: ROUTE });
  const colony = usePublicColony(handle, slug);
  const overview = usePublicOverview(colony?.key);

  return (
    <div className="flex min-h-dvh flex-col bg-mist">
      <header className="mx-auto flex w-full max-w-[110rem] items-center px-5 py-5 sm:px-8">
        <Logo to="/" className="text-ink" />
        <SignInOrApp />
      </header>
      <main className="mx-auto w-full max-w-[110rem] flex-1 px-5 pt-6 pb-20 sm:px-8 sm:pt-10">
        <Link to="/live" className="inline-flex items-center gap-1.5 text-sm text-cobalt-deep hover:underline">
          <ArrowLeft className="size-4" /> Live colonies
        </Link>
        {colony === undefined ? (
          <div className="mt-6 space-y-6" aria-busy="true">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        ) : colony === null || overview === null ? (
          // The same words whether the colony never existed, was renamed or was made private.
          <div className="mt-6 max-w-2xl">
            <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">This colony moved or is private</h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              A colony's address changes when it is renamed, and its player can stop showing it at any time. The live colonies page lists what can be
              seen right now.
            </p>
          </div>
        ) : (
          <>
            <Title colony={colony} />
            {overview === undefined ? <Skeleton className="mt-6 h-72 w-full rounded-2xl" /> : <Sections colony={colony} overview={overview} />}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function SignInOrApp() {
  const { session } = useAuth();
  return (
    <Button asChild variant="outline" className="ml-auto bg-paper">
      {session ? <Link to="/dashboard">Your colonies</Link> : <Link to="/login">Sign in</Link>}
    </Button>
  );
}

/** The colony's name on its faction's panel, with who plays it. */
function Title({ colony }: { colony: PublicColony }) {
  const pictureUrl = useStoredPicture(colony.picture?.path, colony.picture?.version);
  const look = factionLook(colony.faction);
  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl px-6 py-5 pl-7" style={factionPanelStyle(colony.faction)}>
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: look.accent }} aria-hidden />
      <h1 className="text-3xl leading-tight font-bold tracking-tight break-words sm:text-4xl">{colony.name}</h1>
      <div className="mt-2 flex min-w-0 items-center gap-2 text-sm" style={{ color: look.sub }}>
        <Avatar url={pictureUrl} name={colony.handle} className="size-6 text-xs" />
        <span className="truncate">{colony.handle}</span>
        <FactionPill faction={colony.faction} />
      </div>
    </div>
  );
}

function Sections({ colony, overview }: { colony: PublicColony; overview: PublicOverview }) {
  const [openTile, setOpenTile] = useState<string>();
  const number = (prefix: string) => overview.numbers.find((n) => n.metric.prefix === prefix);
  const hasPopulation = !!number("Pop");
  // As on the owner's page: goods are tiles when pinned or tracked and a line on the list
  // otherwise; other numbers are tiles when tracked; population and bots belong to the block.
  const goods = overview.numbers.filter((n) => n.metric.kind === "resource");
  const goodsTiles = goods.filter((n) => n.pinned || n.tracked);
  const goodsList = goods.filter((n) => !n.pinned && !n.tracked && n.value.kind !== "waiting");
  const others = overview.numbers.filter((n) => n.metric.kind !== "resource" && n.tracked && !(hasPopulation && POPULATION_BLOCK_METRICS.includes(n.metric.prefix)));
  const tile = (n: PublicNumber) => (
    <NumberTile key={n.metric.prefix} colonyKey={colony.key} overview={overview} number={n} open={openTile === n.metric.prefix} onToggle={() => setOpenTile(openTile === n.metric.prefix ? undefined : n.metric.prefix)} />
  );
  const weatherNow = overview.weather;

  return (
    <>
      <StatusBandView
        date={overview.date ? formatGameDate(overview.date.cycle, overview.date.day) : undefined}
        weather={
          weatherNow
            ? { weather: weatherNow.now, note: weatherNow.days ? `Day ${weatherNow.days} of this ${weatherInfo(weatherNow.now).label.toLowerCase()}` : undefined }
            : undefined
        }
        status={
          // The same rule and words as the live colonies list, so the two never disagree.
          overview.lastHeardAt !== null && Date.now() - overview.lastHeardAt < LIVE_MS
            ? { live: true, heard: true, text: "Live" }
            : { live: false, heard: overview.lastHeardAt !== null, text: overview.lastHeardAt !== null ? `Last played ${timeAgo(overview.lastHeardAt)}` : "Nothing received yet" }
        }
      />
      <div className="mt-8">
        <TrackerSections
          time={(overview.date || weatherNow) && <TimeWeather overview={overview} />}
          population={
            (hasPopulation || others.length > 0) && (
              <div className="space-y-4">
                {hasPopulation && <Population colonyKey={colony.key} overview={overview} />}
                {others.length > 0 && <TileGrid>{others.map(tile)}</TileGrid>}
              </div>
            )
          }
          goods={
            (goodsTiles.length > 0 || goodsList.length > 0) && (
              <>
                {goodsTiles.length > 0 && <TileGrid>{goodsTiles.map(tile)}</TileGrid>}
                {goodsList.length > 0 && (
                  <section className="mt-4 rounded-2xl border bg-paper p-5 first:mt-0 sm:p-6" aria-labelledby="public-storage">
                    <h3 id="public-storage" className="text-base font-semibold">
                      Storage
                    </h3>
                    <p className="mt-1 text-sm text-ink-soft">How full storage is for each good.</p>
                    <ul className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2 2xl:grid-cols-3">
                      {goodsList.map((n) => (
                        <li key={n.metric.prefix} className="flex items-center gap-2.5 py-1.5">
                          <GoodIcon good={n.metric.prefix} className="size-6 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{n.metric.label}</span>
                          <span className="font-medium tabular-nums">{formatValue(n.value, "%")}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )
          }
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- time and weather

type CycleRow = { number: number; temperate: number; hazard?: Weather; hazardDays: number; ongoing: boolean };

/** Cycles from the weather periods: each starts with temperate weather and may end in a hazard. */
function cyclesOf(periods: PublicPeriod[], currentCycle: number): CycleRow[] {
  const cycles: Omit<CycleRow, "number">[] = [];
  for (const p of periods) {
    if (p.weather === "temperate") cycles.push({ temperate: p.days, hazardDays: 0, ongoing: p.ongoing });
    else if (cycles.length) {
      const c = cycles[cycles.length - 1];
      c.hazard = p.weather;
      c.hazardDays += p.days;
      c.ongoing = p.ongoing;
    }
  }
  return cycles.map((c, i) => ({ ...c, number: currentCycle - (cycles.length - 1 - i) })).reverse();
}

function TimeWeather({ overview }: { overview: PublicOverview }) {
  const [allLog, setAllLog] = useState(false);
  const [allCycles, setAllCycles] = useState(false);
  const periods = overview.periods;
  const totalDays = periods.reduce((n, p) => n + p.days, 0);
  const log = [...periods].reverse().slice(0, 20);
  const cycles = overview.date ? cyclesOf(periods, overview.date.cycle).slice(0, 8) : [];
  const more = (shown: boolean, hidden: number, toggle: () => void) =>
    hidden > 0 && (
      <Button variant="link" size="sm" className="mt-1 px-0 text-cobalt-deep" aria-expanded={shown} onClick={toggle}>
        {shown ? "Show fewer" : `Show ${hidden} more`}
      </Button>
    );

  return (
    <article className="space-y-6 rounded-2xl border bg-paper p-5 sm:p-6">
      {totalDays > 0 && (
        <div>
          <div className="mb-2 text-sm text-ink-soft">{overview.days >= GAME_DAY_WINDOW ? `Last ${GAME_DAY_WINDOW} game days` : "Since the game clock started"}</div>
          <GameDayTimeline segments={periods} totalDays={totalDays} />
        </div>
      )}
      {overview.weather && (
        <div>
          <h3 className="text-sm font-medium">Weather so far</h3>
          <dl className="mt-2 grid grid-cols-3 gap-2">
            {WEATHERS.map((w) => (
              <div key={w.key} className="rounded-xl bg-mist-2/60 p-3">
                <dt className="flex flex-col gap-1.5 text-sm">
                  <WeatherBadge weather={w.key} size="sm" />
                  {w.label}
                </dt>
                <dd className="mt-2 font-display text-2xl leading-none font-bold tabular-nums">{overview.weatherCounts[w.key]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-ink-soft">How many times each weather has started.</p>
        </div>
      )}
      {cycles.length > 0 && (
        <section>
          <h3 className="text-sm font-medium">Cycles</h3>
          <ol className="mt-2 divide-y">
            {cycles.slice(0, allCycles ? undefined : CYCLE_ROWS).map((c) => (
              <li key={c.number} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 font-medium tabular-nums">Cycle {c.number.toLocaleString()}</span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-ink-soft">
                  <span className="inline-flex items-center gap-1.5">
                    <WeatherBadge weather="temperate" size="sm" /> {pluralDays(c.temperate)}
                  </span>
                  {c.hazard && (
                    <span className="inline-flex items-center gap-1.5">
                      <WeatherBadge weather={c.hazard} size="sm" /> {pluralDays(c.hazardDays)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right font-medium tabular-nums">
                  {pluralDays(c.temperate + c.hazardDays)}
                  {c.ongoing && " so far"}
                </span>
              </li>
            ))}
          </ol>
          {more(allCycles, cycles.length - CYCLE_ROWS, () => setAllCycles(!allCycles))}
        </section>
      )}
      {log.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Weather log</h3>
          <ol className="mt-2 divide-y">
            {log.slice(0, allLog ? undefined : LOG_ROWS).map((p, i) => (
              <li key={log.length - i} className="flex items-center gap-3 py-2 text-sm">
                <WeatherBadge weather={p.weather} size="sm" />
                <span className="min-w-0 flex-1 font-medium">{weatherInfo(p.weather).label}</span>
                <span className="shrink-0 text-right text-ink-soft tabular-nums">
                  {pluralDays(p.days)}
                  {p.ongoing && " so far"}
                </span>
              </li>
            ))}
          </ol>
          {more(allLog, log.length - LOG_ROWS, () => setAllLog(!allLog))}
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------- population and tiles

const WAITING: Value = { kind: "waiting" };

function Population({ colonyKey, overview }: { colonyKey: string; overview: PublicOverview }) {
  const { dayStarts, now } = publicTimeline(overview);
  const of = (prefix: string): PopulationSeries => {
    const n = overview.numbers.find((x) => x.metric.prefix === prefix);
    // Hooks run in the same order every render: the four metrics are fixed.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const history = usePublicHistory(colonyKey, n, overview.days > 0);
    return { value: n?.value ?? WAITING, history: history ?? [], loaded: !n || overview.days === 0 || history !== undefined };
  };
  const pop = of("Pop");
  const adults = of("Adults");
  const young = of("Children");
  const bots = of("Bots");
  return (
    <PopulationChart
      pop={pop}
      adults={adults}
      young={young}
      bots={bots}
      split={adults.value.kind !== "waiting" && young.value.kind !== "waiting"}
      gameDays={overview.days > 0}
      dayStarts={dayStarts}
      daysLoaded
      now={now}
      loading={false}
    />
  );
}

function NumberTile({ colonyKey, overview, number, open, onToggle }: { colonyKey: string; overview: PublicOverview; number: PublicNumber; open: boolean; onToggle: () => void }) {
  const history = usePublicHistory(colonyKey, number, open && overview.days > 0);
  const { dayStarts, now } = publicTimeline(overview);
  const resource = number.metric.kind === "resource";
  return (
    <TileShell metric={number.metric} value={number.value} open={open} onToggle={onToggle} waiting="Nothing reported yet">
      {overview.days === 0 ? (
        <p className="text-sm leading-relaxed text-ink-soft">This colony has no game clock, so its history isn't shown here.</p>
      ) : history === undefined ? (
        <div className="h-[150px] animate-pulse rounded-lg bg-mist-2/60" aria-hidden />
      ) : history.length === 0 ? (
        <p className="text-sm text-ink-soft">No history in the last {GAME_DAY_WINDOW} game days.</p>
      ) : (
        <>
          <div className="mb-2 text-sm text-ink-soft">{overview.days >= GAME_DAY_WINDOW ? `Last ${GAME_DAY_WINDOW} game days` : "Since the game clock started"}</div>
          <ValueChart points={history} now={now} unit={number.metric.unit} suffix={valueSuffix(number.metric)} domain={resource ? [0, 100] : undefined} dayStarts={dayStarts} />
        </>
      )}
    </TileShell>
  );
}
