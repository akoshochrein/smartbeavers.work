// Fills the LOCAL Supabase with a realistic colony: a test player, a colony, a population tracker,
// a weather tracker, a game clock and ~4 months of signal history simulated from Timberborn's rules.
//
//   pnpm db:seed            (run `pnpm db:start` first)
//
// Rules (Normal difficulty, timberborn.wiki.gg "Game Mode", "Weather" and "Time" pages):
//   - every cycle is one temperate season (13-17 game days) then one hazard;
//   - drought 5-9 days, badtide 4-8 days, starting at 38% / 15% of that and reaching full length
//     after 5 cycles; no badtide in the first 4 cycles; badtide chance 40%, 70% after 5 droughts
//     in a row, 100% after 7;
//   - a game day is 768 ticks of 0.6 s (7:40 at 1x); 3x and 7x slow down as the colony grows
//     (x1.8 and x3.4 at 200 beavers);
//   - the game shows the date as "Cycle X, Day Y"; a cycle starts with temperate weather and the
//     day restarts then. The Chronometer (00:00-00:25) signals GameDay at every game midnight.
// Game time only moves while the player is playing, so signals cluster in evening sessions.

import { readFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SECRET = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").match(/^SUPABASE_SECRET_KEY=(.+)$/m)?.[1]?.trim();

const host = new URL(SUPABASE_URL).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  console.error(`Refusing to seed ${SUPABASE_URL}: this script only writes to a local Supabase.`);
  process.exit(1);
}
if (!SECRET) {
  console.error("No SUPABASE_SECRET_KEY in .dev.vars (copy .dev.vars.example and fill it from `pnpm db:start`).");
  process.exit(1);
}

const EMAIL = "test-beaver@example.com";
const COLONY = "Folktails on Plains";
const POP_STEPS = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200];
const COLONY_AGE_DAYS = 120; // real days since the colony was started
const TRACKING_FROM_SESSION = 3; // the player sets up the stations and the clock a few sessions in

// ---------------------------------------------------------------------------------------------
// Deterministic randomness so every seed looks the same.
let seed = 20261110;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const between = (a: number, b: number) => a + rand() * (b - a);
const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());

// ---------------------------------------------------------------------------------------------
// Weather in game time.
type Weather = "Temperate" | "Drought" | "Badtide";
type Season = { weather: Weather; startDay: number; endDay: number };

function buildSeasons(totalDays: number): Season[] {
  const seasons: Season[] = [];
  let day = 0;
  let droughtStreak = 0;
  for (let cycle = 1; day < totalDays; cycle++) {
    const temperate = Math.round(between(13, 17));
    seasons.push({ weather: "Temperate", startDay: day, endDay: day + temperate });
    day += temperate;

    const badtideChance = cycle <= 4 ? 0 : droughtStreak >= 7 ? 1 : droughtStreak >= 5 ? 0.7 : 0.4;
    const badtide = rand() < badtideChance;
    droughtStreak = badtide ? 0 : droughtStreak + 1;
    const [min, max, handicap] = badtide ? [4, 8, 0.15] : [5, 9, 0.38];
    const severity = Math.min(1, handicap + ((1 - handicap) * (cycle - 1)) / 5);
    const length = Math.max(1, Math.round(between(min, max) * severity));
    seasons.push({ weather: badtide ? "Badtide" : "Drought", startDay: day, endDay: day + length });
    day += length;
  }
  return seasons;
}

// ---------------------------------------------------------------------------------------------
// Play sessions in real time, and how fast game time runs during them.
type Session = { start: number; end: number };

function buildSessions(fromMs: number, toMs: number): Session[] {
  const sessions: Session[] = [];
  for (let dayStart = fromMs; dayStart < toMs; dayStart += 86_400_000) {
    const weekday = new Date(dayStart).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    if (rand() > (weekend ? 0.7 : 0.4)) continue;
    const start = dayStart + between(weekend ? 10 : 17, 21) * 3_600_000;
    const end = Math.min(start + between(1, 3.5) * 3_600_000, toMs);
    if (end > start) sessions.push({ start, end });
  }
  return sessions;
}

/** Real seconds per game day at the speed the player mostly uses, for a given population. */
function secondsPerGameDay(population: number): number {
  const t = Math.min(1, Math.max(0, (population - 30) / 170));
  const fast = 3 - t * (3 - 1.8);
  const fastest = 7 - t * (7 - 3.4);
  const speed = 0.15 * 1 + 0.7 * fast + 0.15 * fastest; // mostly 3x, some 1x and 7x
  return 460.8 / speed;
}

// ---------------------------------------------------------------------------------------------
type Signal = { adapter_name: string; state: boolean; received_at: string };

function simulate(now: number) {
  const from = now - COLONY_AGE_DAYS * 86_400_000;
  const sessions = buildSessions(from, now);
  const seasons = buildSeasons(10_000);
  const signals: Signal[] = [];
  const counters = new Map(POP_STEPS.map((s) => [s, false]));

  let gameDay = 0;
  let population = 12;
  let seasonIndex = 0;
  let trackingWeather = false;
  let date = { cycle: 1, day: 1 };
  let anchor: { at: number; cycle: number; day: number } | undefined;

  sessions.forEach((session, i) => {
    trackingWeather ||= i + 1 >= TRACKING_FROM_SESSION;
    if (trackingWeather && !anchor) anchor = { at: session.start, ...date };
    let t = session.start;
    while (t < session.end) {
      // advance one game hour
      const step = secondsPerGameDay(population) / 24;
      t += step * 1000;
      if (t >= session.end) break;
      const previousDay = Math.floor(gameDay + 1e-9);
      gameDay += 1 / 24;
      const at = new Date(t).toISOString();
      const midnight = Math.floor(gameDay + 1e-9) > previousDay;

      // weather change? (seasons are whole days, so this happens at midnight)
      let newCycle = false;
      while (gameDay + 1e-9 >= seasons[seasonIndex].endDay) {
        const before = seasons[seasonIndex].weather;
        seasonIndex++;
        const after = seasons[seasonIndex].weather;
        newCycle ||= after === "Temperate";
        if (trackingWeather) {
          signals.push({ adapter_name: `Weather${before}`, state: false, received_at: at });
          signals.push({ adapter_name: `Weather${after}`, state: true, received_at: new Date(t + 1000).toISOString() });
        }
      }

      // a new game day: the Chronometer switches on, the calendar moves on
      if (midnight) {
        date = newCycle ? { cycle: date.cycle + 1, day: 1 } : { cycle: date.cycle, day: date.day + 1 };
        if (trackingWeather) signals.push({ adapter_name: "GameDay", state: true, received_at: new Date(t + 2000).toISOString() });
      }

      // population: grows towards housing capacity, suffers in bad weather, births/deaths jitter
      const cycle = Math.floor(seasonIndex / 2) + 1;
      const capacity = 12 + 190 * (1 - Math.exp(-cycle / 14));
      const weather = seasons[seasonIndex].weather;
      const growth = weather === "Temperate" ? 0.02 : -0.012 * Math.min(1, cycle / 6);
      population += (growth * (capacity - population * (weather === "Temperate" ? 1 : 0))) / 24 + gauss() * 0.35;
      population = Math.max(6, population);

      for (const step of POP_STEPS) {
        const on = Math.round(population) >= step;
        if (on !== counters.get(step)) {
          counters.set(step, on);
          signals.push({ adapter_name: `Pop${step}`, state: on, received_at: at });
        }
      }
    }
  });

  // the last few cycles as the game would count them: temperate days + hazard days
  const recentCycles: string[] = [];
  for (let i = seasonIndex - (seasonIndex % 2); i >= 0 && recentCycles.length < 4; i -= 2) {
    const t = seasons[i];
    const h = seasons[i + 1];
    const tDays = Math.round(Math.min(t.endDay, gameDay) - t.startDay);
    const hDays = i + 1 <= seasonIndex ? Math.round(Math.min(h.endDay, gameDay) - h.startDay) : null;
    recentCycles.push(
      `cycle ${Math.floor(i / 2) + 1}: temperate ${tDays}${hDays !== null ? `, ${h.weather.toLowerCase()} ${hDays}` : ""}`,
    );
  }
  return { sessions, signals, cycles: Math.floor(seasonIndex / 2) + 1, population: Math.round(population), gameDay, date, anchor: anchor!, recentCycles };
}

// ---------------------------------------------------------------------------------------------
async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { apikey: SECRET!, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json", ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  // player
  const users = await api(`/auth/v1/admin/users?per_page=1000`);
  let user = users.users.find((u: { email: string }) => u.email === EMAIL);
  user ??= await api(`/auth/v1/admin/users`, { method: "POST", body: JSON.stringify({ email: EMAIL, email_confirm: true }) });

  // colony
  let [colony] = await api(`/rest/v1/colonies?owner_id=eq.${user.id}&name=eq.${encodeURIComponent(COLONY)}&select=*`);
  colony ??= (
    await api(`/rest/v1/colonies`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ name: COLONY, owner_id: user.id, faction: "folktails" }),
    })
  )[0];

  // trackers
  await api(`/rest/v1/ladders?colony_id=eq.${colony.id}&metric=eq.Pop`, { method: "DELETE" });
  await api(`/rest/v1/ladders`, {
    method: "POST",
    body: JSON.stringify({ colony_id: colony.id, metric: "Pop", comparison: "gte" }),
  });
  await api(`/rest/v1/weather_trackers`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({ colony_id: colony.id }),
  });

  // history
  await api(`/rest/v1/game_clocks?colony_id=eq.${colony.id}`, { method: "DELETE" });
  await api(`/rest/v1/adapter_events?colony_id=eq.${colony.id}`, { method: "DELETE" });
  await api(`/rest/v1/adapter_states?colony_id=eq.${colony.id}`, { method: "DELETE" });

  const now = Date.now();
  const sim = simulate(now);
  const rows = sim.signals.map((s) => ({ ...s, colony_id: colony.id }));
  for (let i = 0; i < rows.length; i += 1000) {
    await api(`/rest/v1/adapter_events`, { method: "POST", body: JSON.stringify(rows.slice(i, i + 1000)) });
  }

  const latest = new Map<string, Signal>();
  for (const s of sim.signals) latest.set(s.adapter_name, s);
  await api(`/rest/v1/adapter_states`, {
    method: "POST",
    body: JSON.stringify(
      [...latest.values()].map((s) => ({ colony_id: colony.id, name: s.adapter_name, state: s.state, updated_at: s.received_at })),
    ),
  });

  await api(`/rest/v1/game_clocks`, {
    method: "POST",
    body: JSON.stringify({
      colony_id: colony.id,
      anchor_at: new Date(sim.anchor.at).toISOString(),
      anchor_cycle: sim.anchor.cycle,
      anchor_day: sim.anchor.day,
    }),
  });
  const [date] = await api(`/rest/v1/rpc/game_date`, { method: "POST", body: JSON.stringify({ p_colony: colony.id }) });

  const weatherSignals = sim.signals.filter((s) => s.adapter_name.startsWith("Weather"));
  const daySignals = sim.signals.filter((s) => s.adapter_name === "GameDay");
  const playHours = sim.sessions.reduce((h, s) => h + (s.end - s.start) / 3_600_000, 0);
  console.log(`Seeded "${COLONY}" for ${EMAIL} (colony ${colony.id})`);
  console.log(`  ${sim.sessions.length} play sessions, ${playHours.toFixed(0)} h of play over ${COLONY_AGE_DAYS} days`);
  console.log(`  ${sim.gameDay.toFixed(0)} game days, ${sim.cycles} weather cycles, population now ~${sim.population}`);
  console.log(
    `  ${sim.signals.length} signals: ${weatherSignals.length} weather, ${daySignals.length} game days, ${sim.signals.length - weatherSignals.length - daySignals.length} population`,
  );
  console.log(`  clock set up at cycle ${sim.anchor.cycle}, day ${sim.anchor.day}`);
  const match = date.cycle === sim.date.cycle && date.day === sim.date.day;
  console.log(
    `  game date: simulated cycle ${sim.date.cycle}, day ${sim.date.day}; database says cycle ${date.cycle}, day ${date.day} ${match ? "(match)" : "(MISMATCH)"}`,
  );
  if (!match) process.exitCode = 1;
  console.log(`  recent cycles (game days): ${sim.recentCycles.join("; ")}`);
  console.log(`Sign in at http://localhost:5173/login as ${EMAIL} (the link arrives in Mailpit, http://127.0.0.1:54324).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
