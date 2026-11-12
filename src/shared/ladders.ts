// Number trackers: turning on/off adapter signals back into a number.
//
// The player builds in-game counters at whatever numbers they like (e.g. "Total population ≥ 30")
// and wires each to an HTTP Adapter named <prefix><number> (e.g. "Pop30"). Nothing is declared
// up front: every adapter whose name fits is a step of the tracker as soon as it reports.
//
// A counter switching on or off is the value crossing its number, so the latest signal gives the
// value at that moment: "Pop30 on" means 30, "Pop30 off" means 29.

export type Comparison = "gte" | "gt";

export type MetricGroup = "Population" | "Housing" | "Work" | "Health";

export type Metric = {
  /** Adapter name prefix. Letters only (the wiki recommends letters + digits for names). */
  prefix: string;
  label: string;
  unit: string;
  /** The option to pick in the Population Counter's dropdown in-game, spelled as the game spells it. */
  counterSetting: string;
  group: MetricGroup;
};

// Every option in the Population Counter's dropdown, in the game's order (checked against the
// in-game panel, Nov 2026). Prefixes are kept short because they're typed in the game.
export const METRICS: Metric[] = [
  { prefix: "Pop", label: "Population", unit: "beavers and bots", counterSetting: "Total population", group: "Population" },
  { prefix: "Beavers", label: "Beavers", unit: "beavers", counterSetting: "Total beavers", group: "Population" },
  { prefix: "Adults", label: "Adults", unit: "adults", counterSetting: "Adults", group: "Population" },
  { prefix: "Children", label: "Children", unit: "children", counterSetting: "Children", group: "Population" },
  { prefix: "Bots", label: "Bots", unit: "bots", counterSetting: "Bots", group: "Population" },
  { prefix: "OccupiedBeds", label: "Occupied beds", unit: "occupied beds", counterSetting: "Occupied beds", group: "Housing" },
  { prefix: "FreeBeds", label: "Free beds", unit: "free beds", counterSetting: "Free beds", group: "Housing" },
  { prefix: "Homeless", label: "Homeless", unit: "homeless", counterSetting: "Homeless", group: "Housing" },
  { prefix: "Jobs", label: "Jobs", unit: "jobs", counterSetting: "Jobs", group: "Work" },
  { prefix: "Employed", label: "Employed", unit: "employed", counterSetting: "Employed", group: "Work" },
  { prefix: "Unemployed", label: "Unemployed", unit: "unemployed", counterSetting: "Unemployed", group: "Work" },
  { prefix: "Vacancies", label: "Vacancies", unit: "vacancies", counterSetting: "Vacancies", group: "Work" },
  { prefix: "Workers", label: "Workers", unit: "workers", counterSetting: "Total workers", group: "Work" },
  { prefix: "Healthy", label: "Healthy workers", unit: "healthy workers", counterSetting: "Healthy workers", group: "Health" },
  { prefix: "Unhealthy", label: "Unhealthy workers", unit: "unhealthy workers", counterSetting: "Unhealthy workers", group: "Health" },
  { prefix: "Contam", label: "Contaminated", unit: "contaminated", counterSetting: "Contaminated total", group: "Health" },
  { prefix: "ContamAdults", label: "Contaminated adults", unit: "contaminated adults", counterSetting: "Contaminated adults", group: "Health" },
  { prefix: "ContamChildren", label: "Contaminated children", unit: "contaminated children", counterSetting: "Contaminated children", group: "Health" },
];

export const METRIC_GROUPS: MetricGroup[] = ["Population", "Housing", "Work", "Health"];

// Trackers created before the list matched the game: "Beds" counted free beds.
const LEGACY: Metric[] = [{ prefix: "Beds", label: "Free beds", unit: "free beds", counterSetting: "Free beds", group: "Housing" }];

export function metricFor(prefix: string): Metric {
  return (
    [...METRICS, ...LEGACY].find((m) => m.prefix === prefix) ?? { prefix, label: prefix, unit: "", counterSetting: prefix, group: "Population" }
  );
}

export const adapterName = (prefix: string, threshold: number) => `${prefix}${threshold}`;

export const comparisonSymbol = (c: Comparison) => (c === "gt" ? ">" : "≥");

/** Smallest value for which a step's adapter is ON. */
export const lowerBound = (threshold: number, c: Comparison) => (c === "gt" ? threshold + 1 : threshold);

const MAX_THRESHOLD = 100_000;

/** The number in an adapter name such as "Pop30", or undefined if the name isn't one of this tracker's. */
export function thresholdOf(prefix: string, name: string): number | undefined {
  if (!name.startsWith(prefix)) return undefined;
  const digits = name.slice(prefix.length);
  if (!/^\d{1,6}$/.test(digits)) return undefined;
  const n = Number(digits);
  // Reject "Pop030": its canonical name is "Pop30", and two names for one step would clash.
  return n <= MAX_THRESHOLD && String(n) === digits ? n : undefined;
}

export type Step = { threshold: number; name: string; bound: number; state: boolean; at: number };

type LadderLike = { metric: string; comparison: string };
type StateLike = { name: string; state: boolean; updated_at: string };

/** Every adapter that has reported under this tracker's prefix, lowest number first. */
export function discoverSteps(ladder: LadderLike, states: Iterable<StateLike>): Step[] {
  const c = ladder.comparison as Comparison;
  const steps: Step[] = [];
  for (const s of states) {
    const threshold = thresholdOf(ladder.metric, s.name);
    if (threshold === undefined) continue;
    steps.push({ threshold, name: s.name, bound: lowerBound(threshold, c), state: s.state, at: Date.parse(s.updated_at) });
  }
  return steps.sort((a, b) => a.bound - b.bound);
}

export type Value =
  | { kind: "waiting" }
  /**
   * reached / below: the latest signal was the value crossing `bound`, so `value` was exact then.
   * atLeast / under: all we know is which side of `bound` the value is on.
   */
  | { kind: "reached" | "below" | "atLeast" | "under"; value: number; bound: number; at: number };

/**
 * The latest value the signals pin down. Normally that's the most recent signal: a counter that
 * just switched on puts the value at its number, one that just switched off puts it one below.
 * A signal that isn't a real crossing (a counter flipped by hand while testing, say) is skipped
 * in favour of what the counters agree on.
 */
export function latestValue(steps: Pick<Step, "bound" | "state" | "at">[]): Value {
  if (steps.length === 0) return { kind: "waiting" };
  let latest = steps[0];
  let highestOn: (typeof steps)[number] | undefined;
  let lowestOff: (typeof steps)[number] | undefined;
  for (const s of steps) {
    if (s.at > latest.at) latest = s;
    if (s.state && (!highestOn || s.bound > highestOn.bound)) highestOn = s;
    if (!s.state && (!lowestOff || s.bound < lowestOff.bound)) lowestOff = s;
  }
  const crossing = (s: typeof latest): Value =>
    s.state ? { kind: "reached", value: s.bound, bound: s.bound, at: s.at } : { kind: "below", value: s.bound - 1, bound: s.bound, at: s.at };

  // Counters disagree (a higher one on, a lower one off): some state is stale, so trust the newest.
  if (highestOn && lowestOff && highestOn.bound >= lowestOff.bound) return crossing(latest);
  if (latest === highestOn || latest === lowestOff) return crossing(latest);
  if (highestOn) return { kind: "atLeast", value: highestOn.bound, bound: highestOn.bound, at: highestOn.at };
  return { kind: "under", value: lowestOff!.bound - 1, bound: lowestOff!.bound, at: lowestOff!.at };
}

export function formatValue(v: Value): string {
  if (v.kind === "waiting") return "Waiting for data";
  if (v.kind === "atLeast") return `${v.value.toLocaleString()}+`;
  if (v.kind === "under") return `<${v.bound.toLocaleString()}`;
  return v.value.toLocaleString();
}

/** "Reached 30", "Dropped below 30", "At least 30", "Under 30". */
export function describeValue(v: Exclude<Value, { kind: "waiting" }>): string {
  const n = v.bound.toLocaleString();
  if (v.kind === "reached") return `Reached ${n}`;
  if (v.kind === "below") return `Dropped below ${n}`;
  if (v.kind === "atLeast") return `At least ${n}`;
  return `Under ${n}`;
}

export type HistoryPoint = { t: number; value: Exclude<Value, { kind: "waiting" }> };

/** Replays adapter events (oldest first) into the value after every signal for this tracker. */
export function ladderHistory(
  ladder: LadderLike,
  events: { adapter_name: string; state: boolean; received_at: string }[],
): HistoryPoint[] {
  const c = ladder.comparison as Comparison;
  const steps = new Map<string, { bound: number; state: boolean; at: number }>();
  const points: HistoryPoint[] = [];
  for (const e of events) {
    const threshold = thresholdOf(ladder.metric, e.adapter_name);
    if (threshold === undefined) continue;
    const t = Date.parse(e.received_at);
    steps.set(e.adapter_name, { bound: lowerBound(threshold, c), state: e.state, at: t });
    const value = latestValue([...steps.values()]);
    if (value.kind !== "waiting") points.push({ t, value });
  }
  return points;
}
