// What the companion mod sends, shared so the Worker and anything that builds a snapshot
// (the seed script, tests) agree on it.
//
//   POST /mod/<token>
//   {
//     "v": 1,
//     "mod": "0.1.0",
//     "faction": "folktails",
//     "readings": {
//       "adults": 31, "kits": 6, "bots": 4, "free_beds": 3,
//       "weather": "drought", "cycle": 5, "day": 3,
//       "goods": { "Water": 62, "Log": 18 }
//     }
//   }
//
// `readings` holds only what changed since the mod's last request. The mod sends at most every
// 15 seconds, and goods at most once a minute. Without it, or with it
// empty, the request is a heartbeat: it says the game is running and nothing else.
// Goods are named by the game's own ids ("Log", "TreatedPlank"; see gameId in
// src/shared/goods.ts) and their value is how full storage is, 0 to 100.
//
// This contract may still change freely: the mod is not yet released beyond its author.

import { FACTIONS, GOODS, type FactionKey } from "./goods";
import { WEATHERS, type Weather } from "./weather";

export const MOD_CONTRACT_VERSION = 1;

/** Larger request bodies are refused unread. */
export const MAX_SNAPSHOT_BYTES = 4096;

/** Each number the mod sends: the metric it is stored under (the names adapters use) and its highest sensible value. */
const NUMBERS: Record<string, { metric: string; min: number; max: number }> = {
  adults: { metric: "Adults", min: 0, max: 1_000_000 },
  kits: { metric: "Children", min: 0, max: 1_000_000 },
  bots: { metric: "Bots", min: 0, max: 1_000_000 },
  free_beds: { metric: "FreeBeds", min: 0, max: 1_000_000 },
  cycle: { metric: "Cycle", min: 1, max: 100_000 },
  day: { metric: "Day", min: 1, max: 1_000 },
};

/** Weather is stored as a number: its place in WEATHERS. */
export const WEATHER_METRIC = "Weather";
export const weatherValue = (w: Weather) => WEATHERS.findIndex((x) => x.key === w);
export const weatherFromValue = (v: number): Weather | undefined => WEATHERS[v]?.key;

/** The game's id for each good, and the metric its fill is stored under. */
const GOOD_METRICS = new Map(GOODS.map((g) => [g.gameId, g.prefix]));
const FACTION_KEYS = new Set<string>(FACTIONS.map((f) => f.key));

export type Snapshot = { ok: true; readings: Record<string, number>; faction: FactionKey | null } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const wholeNumber = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/**
 * Checks a request body and returns its readings keyed by metric. Names it doesn't know (a
 * newer mod's readings, a good this site doesn't list) are skipped; a known name with a value
 * that makes no sense refuses the whole request, so a broken mod is noticed.
 */
export function parseSnapshot(body: unknown): Snapshot {
  if (!isObject(body)) return { ok: false, error: "the body must be a JSON object" };
  if (body.v !== MOD_CONTRACT_VERSION) return { ok: false, error: `unsupported version: this site understands "v": ${MOD_CONTRACT_VERSION}` };
  const readings = body.readings ?? {};
  if (!isObject(readings)) return { ok: false, error: '"readings" must be an object' };

  const byMetric: Record<string, number> = {};
  for (const [name, value] of Object.entries(readings)) {
    const number = NUMBERS[name];
    if (number) {
      if (!wholeNumber(value, number.min, number.max)) return { ok: false, error: `"${name}" must be a whole number from ${number.min} to ${number.max}` };
      byMetric[number.metric] = value;
    } else if (name === "weather") {
      const index = WEATHERS.findIndex((w) => w.key === value);
      if (index < 0) return { ok: false, error: `"weather" must be one of ${WEATHERS.map((w) => w.key).join(", ")}` };
      byMetric[WEATHER_METRIC] = index;
    } else if (name === "goods") {
      if (!isObject(value)) return { ok: false, error: '"goods" must be an object' };
      for (const [good, fill] of Object.entries(value)) {
        const metric = GOOD_METRICS.get(good);
        if (!metric) continue;
        if (!wholeNumber(fill, 0, 100)) return { ok: false, error: `"goods.${good}" must be a whole number from 0 to 100` };
        byMetric[metric] = fill;
      }
    }
  }

  const faction = typeof body.faction === "string" && FACTION_KEYS.has(body.faction) ? (body.faction as FactionKey) : null;
  return { ok: true, readings: byMetric, faction };
}
