import type { WeatherPeriod } from "./weather";

// Game clock: a Chronometer set to 00:00-00:25 switches its HTTP Adapter on at every game
// midnight, so each "on" signal from this adapter is the start of a new game day.
// The Chronometer moves in 15-minute steps and shows hours as decimals, so 00:25 means 0.25 h
// (a quarter hour, 8 ticks): its shortest window (timberborn.wiki.gg/wiki/Chronometer).

export const CLOCK_ADAPTER = "GameDay";

export const formatGameDate = (cycle: number, day: number) => `Cycle ${cycle.toLocaleString()}, day ${day}`;

export type ClockStatus =
  | { kind: "waiting" }
  | { kind: "running"; secondsPerDay: number | null }
  | { kind: "stopped"; since: number };

/**
 * Running while day signals keep arriving at the usual pace; otherwise the game is paused or
 * closed. "Usual" is the typical real-time length of a game day, with headroom for slow
 * speeds and short pauses.
 */
export function clockStatus(lastDayAt: string | null, secondsPerDay: number | null, now: number): ClockStatus {
  if (!lastDayAt) return { kind: "waiting" };
  const last = Date.parse(lastDayAt);
  const allowance = Math.max(90, (secondsPerDay ?? 460) * 2.5) * 1000;
  return now - last < allowance ? { kind: "running", secondsPerDay } : { kind: "stopped", since: last };
}

export const pluralDays = (n: number) => `${n.toLocaleString()} ${n === 1 ? "day" : "days"}`;

// ---------------------------------------------------------------------------------------------
// Cycles: a cycle starts when temperate weather starts and includes the hazard that follows.


export type Cycle = {
  number: number;
  start: number;
  /** When its hazard (drought or badtide) started, if it has yet. */
  hazardStart: number | null;
  hazard: "drought" | "badtide" | null;
  /** When the next cycle started; null for the current one. */
  end: number | null;
};

/**
 * Groups weather periods (oldest first) into cycles, numbering back from the current cycle.
 * Periods before the first temperate start can't be placed in a cycle and are skipped.
 */
export function buildCycles(periods: WeatherPeriod[], currentCycle: number): Cycle[] {
  const cycles: Omit<Cycle, "number">[] = [];
  for (const p of periods) {
    if (p.weather === "temperate") {
      const prev = cycles[cycles.length - 1];
      if (prev) prev.end = p.start;
      cycles.push({ start: p.start, hazardStart: null, hazard: null, end: null });
    } else {
      const open = cycles[cycles.length - 1];
      if (open && open.hazardStart === null) {
        open.hazardStart = p.start;
        open.hazard = p.weather;
      }
    }
  }
  return cycles.map((c, i) => ({ ...c, number: currentCycle - (cycles.length - 1 - i) }));
}

/**
 * Bounds for counting game days per cycle part, oldest first: each cycle contributes its start
 * and (if any) its hazard start; the list ends with `openEnd`. Count i between bounds i and i+1.
 */
export function cycleBounds(cycles: Cycle[], openEnd: number): number[] {
  const bounds: number[] = [];
  for (const c of cycles) {
    bounds.push(c.start);
    if (c.hazardStart !== null) bounds.push(c.hazardStart);
  }
  if (bounds.length) bounds.push(cycles[cycles.length - 1].end ?? openEnd);
  return bounds;
}
