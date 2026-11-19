// What the companion mod sends, shared so the Worker and anything that builds a snapshot
// (the seed script, tests) agree on it.
//
//   POST /mod/<token>
//   { "v": 1, "mod": "0.1.0", "readings": { "adults": 31, "kits": 6, "bots": 4 } }
//
// `readings` holds only what changed since the mod's last request. Without it, or with it
// empty, the request is a heartbeat: it says the game is running and nothing else.
//
// This contract may still change freely: the mod is not yet released beyond its author.

export const MOD_CONTRACT_VERSION = 1;

/** Larger request bodies are refused unread. */
export const MAX_SNAPSHOT_BYTES = 4096;

const MAX_READING = 1_000_000;

/** Each name the mod sends, and the metric it is stored under (the same names adapters use). */
const READING_METRICS: Record<string, string> = {
  adults: "Adults",
  kits: "Children",
  bots: "Bots",
};

export type Snapshot = { ok: true; readings: Record<string, number> } | { ok: false; error: string };

/** Checks a request body and returns its readings keyed by metric. Names it doesn't know are skipped. */
export function parseSnapshot(body: unknown): Snapshot {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "the body must be a JSON object" };
  const { v, readings = {} } = body as { v?: unknown; readings?: unknown };
  if (v !== MOD_CONTRACT_VERSION) return { ok: false, error: `unsupported version: this site understands "v": ${MOD_CONTRACT_VERSION}` };
  if (typeof readings !== "object" || readings === null || Array.isArray(readings)) return { ok: false, error: '"readings" must be an object' };

  const byMetric: Record<string, number> = {};
  for (const [name, value] of Object.entries(readings)) {
    const metric = READING_METRICS[name];
    if (!metric) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_READING) {
      return { ok: false, error: `"${name}" must be a whole number from 0 to ${MAX_READING}` };
    }
    byMetric[metric] = value;
  }
  return { ok: true, readings: byMetric };
}
