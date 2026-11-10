// Threshold ladders: turning on/off adapter signals back into a number range.
//
// The player builds one in-game counter per threshold (e.g. "Total population ≥ 30") and
// wires each to an HTTP Adapter named <prefix><threshold> (e.g. "Pop30"). An adapter is ON
// while the colony is at or above its step, so the highest ON step and the lowest OFF step
// bracket the real value.

export type Comparison = "gte" | "gt";

export type Metric = {
  /** Adapter name prefix. Letters only (the wiki recommends letters + digits for names). */
  prefix: string;
  label: string;
  unit: string;
  /** What to pick in the Population Counter's settings in-game. */
  counterSetting: string;
};

// In-game setting labels come from community guides; verify against the game UI.
export const METRICS: Metric[] = [
  { prefix: "Pop", label: "Population", unit: "beavers", counterSetting: "Total population" },
  { prefix: "Adults", label: "Adults", unit: "adults", counterSetting: "Adults" },
  { prefix: "Children", label: "Children", unit: "children", counterSetting: "Children" },
  { prefix: "Bots", label: "Bots", unit: "bots", counterSetting: "Bots" },
  { prefix: "Unemployed", label: "Unemployed", unit: "unemployed", counterSetting: "Unemployed" },
  { prefix: "Beds", label: "Free beds", unit: "free beds", counterSetting: "Free beds" },
  { prefix: "Jobs", label: "Open jobs", unit: "open jobs", counterSetting: "Job vacancies" },
];

export const MAX_STEPS = 50;

export function metricFor(prefix: string): Metric {
  return (
    METRICS.find((m) => m.prefix === prefix) ?? { prefix, label: prefix, unit: "", counterSetting: prefix }
  );
}

export const adapterName = (prefix: string, threshold: number) => `${prefix}${threshold}`;

export const comparisonSymbol = (c: Comparison) => (c === "gt" ? ">" : "≥");

/** Smallest value for which a step's adapter is ON. */
export const lowerBound = (threshold: number, c: Comparison) => (c === "gt" ? threshold + 1 : threshold);

/** undefined = the adapter hasn't sent anything yet. */
export type StepState = boolean | undefined;

export type Step = { threshold: number; name: string; bound: number; state: StepState };

export type Reading =
  | { kind: "waiting" }
  /** Signals contradict each other, e.g. Pop40 ON while Pop30 OFF. */
  | { kind: "conflict" }
  /** max === null means open-ended ("at least min"). */
  | { kind: "range"; min: number; max: number | null };

type LadderLike = { metric: string; comparison: string; thresholds: number[] };

export function ladderSteps(ladder: LadderLike, stateOf: (name: string) => StepState): Step[] {
  const c = ladder.comparison as Comparison;
  return [...ladder.thresholds]
    .sort((a, b) => a - b)
    .map((threshold) => {
      const name = adapterName(ladder.metric, threshold);
      return { threshold, name, bound: lowerBound(threshold, c), state: stateOf(name) };
    });
}

export function readSteps(steps: Pick<Step, "bound" | "state">[]): Reading {
  let highestOn: number | undefined;
  let lowestOff: number | undefined;
  for (const { bound, state } of steps) {
    if (state === true && (highestOn === undefined || bound > highestOn)) highestOn = bound;
    if (state === false && (lowestOff === undefined || bound < lowestOff)) lowestOff = bound;
  }
  if (highestOn === undefined && lowestOff === undefined) return { kind: "waiting" };
  if (highestOn !== undefined && lowestOff !== undefined && highestOn >= lowestOff) return { kind: "conflict" };
  return { kind: "range", min: highestOn ?? 0, max: lowestOff === undefined ? null : lowestOff - 1 };
}

export function formatReading(r: Reading): string {
  if (r.kind === "waiting") return "Waiting for data";
  if (r.kind === "conflict") return "Conflicting signals";
  if (r.max === null) return `${r.min}+`;
  if (r.min === r.max) return `${r.min}`;
  return `${r.min}–${r.max}`;
}

export type HistoryPoint = { t: number; reading: Reading };

/** Replays adapter events (ascending) into a reading after every change to this ladder. */
export function ladderHistory(
  ladder: LadderLike,
  events: { adapter_name: string; state: boolean; received_at: string }[],
): HistoryPoint[] {
  const names = new Set(ladder.thresholds.map((t) => adapterName(ladder.metric, t)));
  const states = new Map<string, boolean>();
  const points: HistoryPoint[] = [];
  for (const e of events) {
    if (!names.has(e.adapter_name)) continue;
    states.set(e.adapter_name, e.state);
    const reading = readSteps(ladderSteps(ladder, (n) => states.get(n)));
    points.push({ t: Date.parse(e.received_at), reading });
  }
  return points;
}

/** from..to inclusive, every `step`. Returns an error string instead of a huge list. */
export function generateThresholds(from: number, to: number, step: number): number[] | string {
  if (![from, to, step].every(Number.isInteger)) return "Use whole numbers.";
  if (from < 0) return "Start can't be negative.";
  if (step < 1) return "Step must be at least 1.";
  if (to < from) return "End must be at least the start.";
  const count = Math.floor((to - from) / step) + 1;
  if (count > MAX_STEPS) return `That's ${count} counters. Keep it to ${MAX_STEPS} or fewer (try a bigger step).`;
  return Array.from({ length: count }, (_, i) => from + i * step);
}
