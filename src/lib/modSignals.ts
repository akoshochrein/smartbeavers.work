import type { ColonyReadings } from "./readings";
import type { AdapterEvent, AdapterState } from "./supabase";
import type { ColonyFeed } from "./useColonyFeed";
import { CLOCK_ADAPTER } from "@/shared/clock";
import { WEATHER_METRIC, weatherFromValue } from "@/shared/mod";
import { WEATHER_ADAPTERS, weatherInfo } from "@/shared/weather";

const DAY_METRIC = "Day";
const WEATHER_NAMES = new Set(WEATHER_ADAPTERS);

/**
 * The colony's feed with the companion mod's weather and day folded in, for the weather and game
 * clock cards. Those cards read four adapters with fixed names; here the mod's readings stand in
 * for them, the same way the `colony_signals` database view does for history:
 *   - while the mod is reporting a metric, or no adapter has reported it since, its reading is the state;
 *   - a new weather or day reading becomes the signal the adapter would have sent;
 *   - real signals from those adapters don't count while the mod is reporting.
 * Everything else in the feed is passed through.
 */
export function withModSignals(feed: ColonyFeed, readings: ColonyReadings | undefined): ColonyFeed {
  if (!readings || readings.byMetric.size === 0) return feed;
  const weather = readings.byMetric.get(WEATHER_METRIC);
  const day = readings.byMetric.get(DAY_METRIC);
  if (!weather && !day) return feed;

  const colonyId = [...feed.states.values()][0]?.colony_id ?? readings.live[0]?.colony_id ?? "";
  const states = new Map(feed.states);
  const state = (name: string, on: boolean, at: number): AdapterState => ({ colony_id: colonyId, name, state: on, updated_at: new Date(at).toISOString() });

  const newest = (names: string[]) => names.reduce((t, n) => Math.max(t, feed.states.has(n) ? Date.parse(feed.states.get(n)!.updated_at) : 0), 0);
  const modWeather = !!weather && (weather.reporting || newest(WEATHER_ADAPTERS) <= weather.at);
  if (modWeather) {
    const active = weatherFromValue(weather.value);
    for (const name of WEATHER_ADAPTERS) states.delete(name);
    if (active) states.set(weatherInfo(active).adapter, state(weatherInfo(active).adapter, true, weather.at));
  }
  const modDay = !!day && (day.reporting || newest([CLOCK_ADAPTER]) <= day.at);
  if (modDay) states.set(CLOCK_ADAPTER, state(CLOCK_ADAPTER, true, day.at));

  const fromMod: AdapterEvent[] = [];
  for (const r of readings.live) {
    const name = r.metric === WEATHER_METRIC ? (weatherFromValue(r.value) ? weatherInfo(weatherFromValue(r.value)!).adapter : undefined) : r.metric === DAY_METRIC ? CLOCK_ADAPTER : undefined;
    // The same id the database view gives the row, so a signal loaded later isn't shown twice.
    if (name) fromMod.push({ id: -r.id, colony_id: r.colony_id, adapter_name: name, state: true, received_at: r.received_at });
  }
  const real = feed.live.filter((e) => !(weather?.reporting && WEATHER_NAMES.has(e.adapter_name)) && !(day?.reporting && e.adapter_name === CLOCK_ADAPTER));
  const live = fromMod.length ? [...real, ...fromMod].sort((a, b) => Date.parse(a.received_at) - Date.parse(b.received_at)) : real;

  return { loading: feed.loading, states, live };
}
