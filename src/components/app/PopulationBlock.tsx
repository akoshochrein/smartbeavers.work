import { useEffect, useMemo, useState } from "react";
import { StatusDot } from "@/components/app/StatusDot";
import { Skeleton } from "@/components/ui/skeleton";
import { useGameDayStarts } from "@/lib/clock";
import type { ColonyReadings } from "@/lib/readings";
import type { Ladder } from "@/lib/supabase";
import { formatTime, timeAgo } from "@/lib/time";
import { useTracker } from "@/lib/useTracker";
import { HISTORY_DAYS, type ColonyFeed } from "@/lib/useColonyFeed";
import { describeValue, formatValue, type HistoryPoint } from "@/shared/ladders";

/** With a game clock, the chart shows this many game days (the same window as the tiles' charts). */
const GAME_DAY_WINDOW = 180;
/** Points drawn per game day, and across the whole chart without a clock. */
const PER_DAY = 4;
const REAL_TIME_SAMPLES = 240;

/**
 * The layers the chart can stack, bottom first. Colours are fixed per layer, so hiding one never
 * repaints another. The three were checked together for colour-blind separation on paper; amber
 * is under 3:1 against paper, which is why the legend always shows each layer's name and number.
 */
const LAYERS = {
  Adults: { label: "Adults", colour: "#1c86b0" },
  Children: { label: "Children", colour: "#c98a1c" },
  Beavers: { label: "Beavers", colour: "#1c86b0" },
  Pop: { label: "Population", colour: "#1c86b0" },
  Bots: { label: "Bots", colour: "#a0522d" },
} as const;
type LayerKey = keyof typeof LAYERS;

/** The metrics that the block shows itself, so they need no tile of their own. */
export const POPULATION_BLOCK_METRICS = ["Pop", "Bots"];

/** The value of a history at each of `times` (both oldest first): the last point at or before it. */
function valuesAt(history: HistoryPoint[], times: number[]): (number | undefined)[] {
  let i = -1;
  return times.map((t) => {
    while (i + 1 < history.length && history[i + 1].t <= t) i++;
    return i >= 0 ? history[i].value.value : undefined;
  });
}

/** A round step giving about `count` ticks up to `max`. */
function niceStep(max: number, count: number) {
  const raw = Math.max(1, max) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
}

/**
 * The colony's population: one total, and a chart of it over time stacked by who it is made of.
 * With the companion mod that is adults, children and bots. From counters it is whatever the
 * player tracks: beavers and bots with a bots tracker, otherwise the population as one layer.
 * Clicking a layer in the legend hides or shows it, and the total follows what is shown.
 */
export function PopulationBlock({
  colonyId,
  feed,
  readings,
  ladders,
  clock,
  dayVersion,
}: {
  colonyId: string;
  feed: ColonyFeed;
  readings: ColonyReadings;
  /** The player's number trackers, for how their counters compare (at least, or more than). */
  ladders: Ladder[];
  /** The colony has a game clock: chart in game days instead of real time. */
  clock: boolean;
  dayVersion: number;
}) {
  const now = useNow(30_000);
  const dayStarts = useGameDayStarts(colonyId, GAME_DAY_WINDOW, clock, dayVersion);
  const like = useMemo(() => {
    const of = (metric: string) => ({ colony_id: colonyId, metric, comparison: ladders.find((l) => l.metric === metric)?.comparison ?? "gte" });
    return { Pop: of("Pop"), Adults: of("Adults"), Children: of("Children"), Bots: of("Bots") };
  }, [colonyId, ladders]);
  const options = { history: true, clock, dayStarts, readingsVersion: readings.version };
  const pop = useTracker(like.Pop, feed, readings.byMetric.get("Pop"), options);
  const adults = useTracker(like.Adults, feed, readings.byMetric.get("Adults"), options);
  const children = useTracker(like.Children, feed, readings.byMetric.get("Children"), options);
  const bots = useTracker(like.Bots, feed, readings.byMetric.get("Bots"), options);
  const [hidden, setHidden] = useState<ReadonlySet<LayerKey>>(new Set());
  const [hover, setHover] = useState<number>();

  const hasBots = bots.value.kind !== "waiting";
  // Adults and children only ever come from the mod; without them the beavers are one layer.
  const split = readings.byMetric.has("Adults") && readings.byMetric.has("Children");
  const layers: LayerKey[] = useMemo(() => (split ? ["Adults", "Children", ...(hasBots ? (["Bots"] as const) : [])] : hasBots ? ["Beavers", "Bots"] : ["Pop"]), [split, hasBots]);
  const shown = layers.map((k) => !hidden.has(k));
  const gameDays = pop.gameDays;

  // Where the chart is sampled. Game days: a few points per day, every day equally wide, so a
  // paused or closed game takes no room. Real time: evenly from the first value to now.
  const samples = useMemo(() => {
    if (gameDays && dayStarts?.length) {
      const out: { t: number; day: number }[] = [];
      dayStarts.forEach((start, day) => {
        const end = dayStarts[day + 1] ?? now;
        for (let k = 0; k < PER_DAY; k++) out.push({ t: start + ((end - start) * k) / PER_DAY, day });
      });
      out.push({ t: now, day: dayStarts.length - 1 });
      return out;
    }
    const t0 = pop.history[0]?.t;
    if (t0 === undefined) return [];
    return Array.from({ length: REAL_TIME_SAMPLES }, (_, i) => ({ t: t0 + ((now - t0) * i) / (REAL_TIME_SAMPLES - 1), day: 0 }));
  }, [gameDays, dayStarts, now, pop.history]);

  const series = useMemo(() => {
    const times = samples.map((s) => s.t);
    const total = valuesAt(pop.history, times);
    const b = valuesAt(bots.history, times);
    const by: Record<LayerKey, (number | undefined)[]> = {
      Pop: total,
      Adults: valuesAt(adults.history, times),
      Children: valuesAt(children.history, times),
      Bots: b,
      Beavers: total.map((v, i) => (v === undefined ? undefined : Math.max(0, v - (b[i] ?? 0)))),
    };
    return times.map((_, i) => {
      const values = layers.map((k) => by[k][i]);
      // Before the layers were reported (a colony that moved from counters to the mod), all
      // that is known is the total: draw it as one plain layer.
      const known = values.every((v, j) => v !== undefined || layers[j] === "Bots");
      return { values: known ? values.map((v) => v ?? 0) : layers.map(() => 0), unsplit: known ? 0 : (total[i] ?? 0) };
    });
  }, [samples, pop.history, adults.history, children.history, bots.history, layers]);

  const sumAt = (i: number) => series[i].values.reduce((n, v, j) => n + (shown[j] ? v : 0), 0) + series[i].unsplit;
  const loaded = pop.loaded && adults.loaded && children.loaded && bots.loaded && (!clock || dayStarts !== undefined);
  const hasChart = series.length > 1 && series.some((_, i) => sumAt(i) > 0);

  // The numbers now. A population from counters may only be known as "at least" or "under".
  const current: Record<LayerKey, number | undefined> = {
    Adults: adults.value.kind === "waiting" ? undefined : adults.value.value,
    Children: children.value.kind === "waiting" ? undefined : children.value.value,
    Bots: bots.value.kind === "waiting" ? undefined : bots.value.value,
    Pop: pop.value.kind === "waiting" ? undefined : pop.value.value,
    Beavers: undefined,
  };
  current.Beavers = current.Pop === undefined ? undefined : Math.max(0, current.Pop - (current.Bots ?? 0));
  const allShown = shown.every(Boolean);
  const headline =
    pop.value.kind === "waiting"
      ? undefined
      : allShown
        ? formatValue(pop.value)
        : layers.reduce((n, k, j) => n + (shown[j] ? (current[k] ?? 0) : 0), 0).toLocaleString();
  const shownNames = layers.filter((_, j) => shown[j]).map((k) => LAYERS[k].label.toLowerCase());
  const unit = allShown ? "beavers and bots" : shownNames.length > 1 ? `${shownNames.slice(0, -1).join(", ")} and ${shownNames.at(-1)}` : shownNames[0];
  const approximate = allShown && (pop.value.kind === "atLeast" || pop.value.kind === "under");

  function toggle(k: LayerKey) {
    const next = new Set(hidden);
    if (next.has(k)) next.delete(k);
    // The last shown layer can't be hidden: an empty chart helps nobody.
    else if (next.size < layers.length - 1) next.add(k);
    setHidden(next);
  }

  // Geometry. The plot is drawn in a fixed box and stretched to its width; strokes don't scale.
  const W = 1000;
  const H = 220;
  const step = niceStep(Math.max(4, ...series.map((_, i) => sumAt(i))), 5);
  const yMax = Math.ceil(Math.max(4, ...series.map((_, i) => sumAt(i))) / step) * step;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const x = (i: number) => (i / Math.max(1, series.length - 1)) * W;
  const y = (v: number) => H - (v / yMax) * H;
  const area = (lower: number[], upper: number[]) => `M${upper.map((v, i) => `${x(i)},${y(v)}`).join("L")}L${lower.map((v, i) => `${x(i)},${y(v)}`).reverse().join("L")}Z`;
  let base = series.map((s) => s.unsplit);
  const bands = layers.map((k, j) => {
    const top = base.map((v, i) => v + (shown[j] ? series[i].values[j] : 0));
    const d = area(base, top);
    base = top;
    return { k, d };
  });
  const unsplitD = area(series.map(() => 0), series.map((s) => s.unsplit));
  const at = hover === undefined || !series.length ? undefined : Math.min(series.length - 1, Math.max(0, hover));
  const when = (i: number) => {
    if (!gameDays) return formatTime(samples[i].t, now);
    const ago = dayStarts!.length - 1 - samples[i].day;
    return ago === 0 ? "Today" : ago === 1 ? "1 game day ago" : `${ago.toLocaleString()} game days ago`;
  };

  return (
    <article className="rounded-2xl border bg-paper p-5 sm:p-6">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          {feed.loading ? (
            <Skeleton className="h-14 w-40" />
          ) : headline === undefined ? (
            <p className="font-display text-xl font-semibold">Waiting for the first counter</p>
          ) : (
            <div className="flex items-baseline gap-3">
              <span className="font-display text-6xl leading-none font-bold tracking-tight tabular-nums">{headline}</span>
              <span className="text-lg text-ink-soft">{unit}</span>
              {approximate && <span className="rounded-md bg-resin-soft px-1.5 py-0.5 text-xs">approximate</span>}
            </div>
          )}
          {pop.value.kind !== "waiting" && (
            <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
              <StatusDot state live={pop.value.kind === "exact" ? !!readings.byMetric.get("Pop")?.reporting : now - pop.value.at < 5 * 60_000} className="size-2" />
              {describeValue(pop.value)} {timeAgo(pop.value.at, now)}
            </p>
          )}
        </div>
        {/* One layer needs no legend: the heading already names it. */}
        {layers.length > 1 && (
          <ul className="flex flex-wrap gap-2 sm:ml-auto" aria-label="Layers of the chart. Press one to hide or show it.">
            {layers.map((k, j) => (
              <li key={k}>
                <button
                  type="button"
                  aria-pressed={shown[j]}
                  onClick={() => toggle(k)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm outline-offset-2 transition-opacity hover:bg-mist/60 ${shown[j] ? "" : "opacity-50"}`}
                >
                  <span className="size-3 rounded-sm" style={{ background: shown[j] ? LAYERS[k].colour : "transparent", boxShadow: `inset 0 0 0 1.5px ${LAYERS[k].colour}` }} aria-hidden />
                  {LAYERS[k].label}
                  <span className="font-medium tabular-nums">{current[k]?.toLocaleString() ?? "…"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loaded ? (
        <Skeleton className="mt-6 h-56 w-full" />
      ) : (
        hasChart && (
          <div className="mt-6 border-t pt-4">
            <div className="mb-3 text-sm text-ink-soft">
              {!gameDays ? `Last ${HISTORY_DAYS} days` : dayStarts!.length >= GAME_DAY_WINDOW ? `Last ${GAME_DAY_WINDOW} game days` : "Since the game clock started"}
            </div>
            <div className="relative pl-10">
              {ticks.map((v) => (
                <span key={v} className="absolute left-0 w-8 -translate-y-1/2 text-right font-mono text-[11px] text-ink-soft tabular-nums" style={{ top: `${(1 - v / yMax) * 100}%` }} aria-hidden>
                  {v.toLocaleString()}
                </span>
              ))}
              <div
                className="relative touch-pan-y"
                onPointerMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setHover(Math.round(((e.clientX - r.left) / r.width) * (series.length - 1)));
                }}
                onPointerLeave={() => setHover(undefined)}
              >
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-56 w-full overflow-visible" role="img" aria-label={`Population over time, stacked by ${layers.map((k) => LAYERS[k].label.toLowerCase()).join(", ")}. Now ${headline ?? "unknown"}.`}>
                  {ticks.map((v) => (
                    <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} className="stroke-ink/10" vectorEffect="non-scaling-stroke" />
                  ))}
                  <path d={unsplitD} fill={LAYERS.Pop.colour} opacity={0.35} />
                  {bands.map((b) => (
                    <path key={b.k} d={b.d} fill={LAYERS[b.k].colour} className="stroke-paper" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  ))}
                  {at !== undefined && <line x1={x(at)} x2={x(at)} y1={0} y2={H} className="stroke-ink/50" vectorEffect="non-scaling-stroke" />}
                </svg>
                {at !== undefined && (
                  <div
                    className="pointer-events-none absolute top-1 z-10 min-w-44 rounded-lg border bg-paper px-3 py-2 text-sm shadow-md"
                    style={at > series.length / 2 ? { right: `${100 - (at / (series.length - 1)) * 100 + 1.5}%` } : { left: `${(at / (series.length - 1)) * 100 + 1.5}%` }}
                  >
                    <div className="mb-1 text-xs text-ink-soft">{when(at)}</div>
                    {series[at].unsplit > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-sm opacity-40" style={{ background: LAYERS.Pop.colour }} />
                        <span className="flex-1">Population</span>
                        <span className="font-medium tabular-nums">{series[at].unsplit.toLocaleString()}</span>
                      </div>
                    ) : (
                      <>
                        {/* Top of the stack first, as it is drawn. */}
                        {[...layers.keys()].reverse().map(
                          (j) =>
                            shown[j] && (
                              <div key={layers[j]} className="flex items-center gap-2">
                                <span className="size-2.5 rounded-sm" style={{ background: LAYERS[layers[j]].colour }} />
                                <span className="flex-1">{LAYERS[layers[j]].label}</span>
                                <span className="font-medium tabular-nums">{series[at].values[j].toLocaleString()}</span>
                              </div>
                            ),
                        )}
                        {shown.filter(Boolean).length > 1 && (
                          <div className="mt-1 flex justify-between gap-6 border-t pt-1 font-medium">
                            <span>Total</span>
                            <span className="tabular-nums">{sumAt(at).toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[11px] text-ink-soft">
                <span>{gameDays ? (dayStarts!.length === 1 ? "start of today" : `${(dayStarts!.length - 1).toLocaleString()} game days ago`) : formatTime(samples[0].t, now)}</span>
                <span>{gameDays ? "today" : "now"}</span>
              </div>
            </div>
          </div>
        )
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
