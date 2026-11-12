// Weather tracking: one Weather Station per weather type, each wired to an HTTP Adapter with a
// fixed name. The station that switched on most recently is the active weather.

export type Weather = "temperate" | "drought" | "badtide";

export type WeatherInfo = {
  key: Weather;
  label: string;
  /** HTTP Adapter name the player gives this station's adapter. Letters only. */
  adapter: string;
  /** What to select in the Weather Station's settings in-game. */
  stationSetting: string;
};

export const WEATHERS: WeatherInfo[] = [
  { key: "temperate", label: "Temperate", adapter: "WeatherTemperate", stationSetting: "Temperate" },
  { key: "drought", label: "Drought", adapter: "WeatherDrought", stationSetting: "Drought" },
  { key: "badtide", label: "Badtide", adapter: "WeatherBadtide", stationSetting: "Badtide" },
];

const BY_ADAPTER = new Map(WEATHERS.map((w) => [w.adapter, w]));
export const WEATHER_ADAPTERS = WEATHERS.map((w) => w.adapter);

export const weatherInfo = (key: Weather) => WEATHERS.find((w) => w.key === key)!;
export const weatherForAdapter = (name: string): WeatherInfo | undefined => BY_ADAPTER.get(name);

type StateLike = { name: string; state: boolean; updated_at: string };

export type CurrentWeather =
  | { kind: "waiting" }
  /** `ended` = its station has since switched off and no other weather has started yet. */
  | { kind: "known"; weather: Weather; since: number; ended: boolean };

/**
 * Latest known weather from adapter states: the most recently switched-on station wins.
 * If no station is on, the last one that was on is reported as ended.
 */
export function currentWeather(states: Iterable<StateLike>): CurrentWeather {
  let latestOn: StateLike | undefined;
  let latestAny: StateLike | undefined;
  for (const s of states) {
    if (!BY_ADAPTER.has(s.name)) continue;
    if (!latestAny || s.updated_at > latestAny.updated_at) latestAny = s;
    if (s.state && (!latestOn || s.updated_at > latestOn.updated_at)) latestOn = s;
  }
  const pick = latestOn ?? latestAny;
  if (!pick) return { kind: "waiting" };
  return { kind: "known", weather: BY_ADAPTER.get(pick.name)!.key, since: Date.parse(pick.updated_at), ended: !latestOn };
}

export type WeatherPeriod = {
  weather: Weather;
  start: number;
  /** When the next weather started; null while it's still the current weather. */
  end: number | null;
  /** When this weather's station switched off, if it did before the next weather started. */
  offAt: number | null;
  /** Already going when the history window opened, so the real start is earlier than `start`. */
  carried: boolean;
};

/** When a period really ended: its station switching off if we saw that, else the next weather starting. */
export const periodEnd = (p: WeatherPeriod): number | null => p.offAt ?? p.end;

/**
 * Turns adapter events (oldest first) into weather periods. A station switching on starts a
 * period and closes the previous one. A repeated "on" for the current weather is ignored.
 */
export function weatherPeriods(events: { adapter_name: string; state: boolean; received_at: string; carried?: boolean }[]): WeatherPeriod[] {
  const periods: WeatherPeriod[] = [];
  for (const e of events) {
    const info = BY_ADAPTER.get(e.adapter_name);
    if (!info) continue;
    const t = Date.parse(e.received_at);
    const open = periods[periods.length - 1];
    if (e.state) {
      if (open && open.end === null && open.weather === info.key) {
        open.offAt = null; // switched back on before anything else started: same period
        continue;
      }
      if (open && open.end === null) open.end = t;
      periods.push({ weather: info.key, start: t, end: null, offAt: null, carried: !!e.carried });
    } else if (open && open.end === null && open.weather === info.key) {
      open.offAt = t;
    }
  }
  return periods;
}

/**
 * Timeline periods from per-slot summaries (the weather that was on for most of each slot):
 * consecutive slots with the same weather merge into one period; the last one runs to `now`.
 */
export function periodsFromSlots(slots: { adapter_name: string; slot_start: string }[], slotMs: number, now: number): WeatherPeriod[] {
  const periods: WeatherPeriod[] = [];
  for (const s of slots) {
    const info = BY_ADAPTER.get(s.adapter_name);
    if (!info) continue;
    const start = Date.parse(s.slot_start);
    const open = periods[periods.length - 1];
    if (open && open.weather === info.key && open.end === start) {
      open.end = start + slotMs;
      continue;
    }
    periods.push({ weather: info.key, start, end: start + slotMs, offAt: null, carried: false });
  }
  const last = periods[periods.length - 1];
  if (last && last.end !== null && last.end >= now) last.end = null;
  return periods;
}

export function formatDuration(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "under a minute";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d} d ${rh} h` : `${d} d`;
}

/**
 * Splits a game-day window into weather segments. `t0` is when the window's first game day began.
 * Returns the moments to count game days between (each segment runs from bounds[i] to
 * bounds[i + 1]) and each segment's weather; null where the weather at the window start is unknown.
 */
export function gameDaySegments(periods: WeatherPeriod[], t0: number, openEnd: number) {
  const before = periods.filter((p) => p.start <= t0);
  const inside = periods.filter((p) => p.start > t0);
  const bounds = [t0, ...inside.map((p) => p.start), openEnd];
  const weathers: (Weather | null)[] = [before.length ? before[before.length - 1].weather : null, ...inside.map((p) => p.weather)];
  return { bounds, weathers };
}
