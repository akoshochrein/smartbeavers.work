import { ArrowLeft, CalendarClock, ChevronRight, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { WeatherBadge } from "@/components/app/weather";
import { DateSetter } from "@/components/app/DateSetter";
import { setGameDate, useGameClock } from "@/lib/clock";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { useColony, useLadders, useWeatherTracker } from "@/lib/useColony";
import { cn } from "@/lib/utils";
import { METRICS, METRIC_GROUPS, RESOURCE_METRICS, adapterName, comparisonSymbol, metricFor, type Comparison, type Metric } from "@/shared/ladders";
import { GOOD_GROUPS, factionLabel, goodsFor } from "@/shared/goods";
import { GoodIcon } from "@/components/app/GoodIcon";
import { Input } from "@/components/ui/input";
import { WEATHERS } from "@/shared/weather";

export function TrackerNew() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const kind = params.get("kind");
  if (kind === "numbers") return <CounterTrackerForm kind="population" />;
  if (kind === "resource") return <CounterTrackerForm kind="resource" />;
  if (kind === "weather") return <WeatherTrackerNew colonyId={id!} />;
  if (kind === "clock") return <GameClockNew colonyId={id!} />;
  return <TrackerChooser colonyId={id!} />;
}

function TrackerChooser({ colonyId }: { colonyId: string }) {
  const [colony] = useColony(colonyId);
  const [weather] = useWeatherTracker(colonyId);
  const [clock] = useGameClock(colonyId);
  if (colony === undefined || weather === undefined || clock === undefined) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (colony === null) return <p className="text-ink-soft">Colony not found.</p>;

  const option = "group flex items-start gap-4 rounded-2xl border bg-paper p-5 transition-colors hover:border-cobalt/50 hover:bg-cobalt-soft/30";
  return (
    <div>
      <BackLink colonyId={colony.id} name={colony.name} />
      <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">New tracker</h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-soft">What do you want to follow?</p>

      <div className="mt-8 grid max-w-5xl gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link to={clock ? `/colonies/${colony.id}/trackers/clock` : "?kind=clock"} className={cn(option, clock && "bg-mist-2/40")}>
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-pine text-mist">
            <CalendarClock className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-semibold">The game clock</span>
            <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
              {clock
                ? "Already set up. Open its setup guide."
                : "The cycle and day like the game shows them, and whether the game is running. Uses one Chronometer."}
            </span>
          </span>
          <ChevronRight className="mt-2 size-5 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" />
        </Link>

        {weather ? (
          <Link to={`/colonies/${colony.id}/trackers/weather`} className={cn(option, "bg-mist-2/40")}>
            <span className="flex shrink-0 -space-x-2">
              {WEATHERS.map((w) => <WeatherBadge key={w.key} weather={w.key} size="md" className="ring-2 ring-paper" />)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-semibold">The weather</span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-soft">Already set up. Open its setup guide.</span>
            </span>
            <ChevronRight className="mt-2 size-5 shrink-0 text-ink-soft" />
          </Link>
        ) : (
          <Link to="?kind=weather" className={option}>
            <span className="flex shrink-0 -space-x-2">
              {WEATHERS.map((w) => <WeatherBadge key={w.key} weather={w.key} size="md" className="ring-2 ring-paper" />)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-semibold">The weather</span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                Which weather is on, how often each one comes, and a log. Uses three Weather Stations.
              </span>
            </span>
            <ChevronRight className="mt-2 size-5 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        <Link to="?kind=resource" className={option}>
          <span className="grid size-10 shrink-0 grid-cols-2 place-items-center gap-0.5 rounded-lg bg-mist-2 p-1">
            {["Water", "Logs", "Berries", "Gears"].map((g) => <GoodIcon key={g} good={g} className="size-3.5" />)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-semibold">Resources</span>
            <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
              How full the storage of any good is, in percent: water, logs, food and the rest. Uses a few Resource Counters.
            </span>
          </span>
          <ChevronRight className="mt-2 size-5 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link to="?kind=numbers" className={option}>
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-cobalt text-white">
            <Users className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-semibold">Population</span>
            <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
              How many beavers and bots you have, plus beds, jobs, workers and contamination. Uses a few Population Counters.
            </span>
          </span>
          <ChevronRight className="mt-2 size-5 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

function GameClockNew({ colonyId }: { colonyId: string }) {
  const navigate = useNavigate();
  const [colony] = useColony(colonyId);
  const [clock] = useGameClock(colonyId);
  const [weather] = useWeatherTracker(colonyId);
  const [value, setValue] = useState({ cycle: 1, day: 1 });
  const [saving, setSaving] = useState(false);

  if (colony === undefined || clock === undefined || weather === undefined) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (colony === null) return <p className="text-ink-soft">Colony not found.</p>;
  if (clock) return <Navigate to={`/colonies/${colony.id}/trackers/clock`} replace />;

  async function start() {
    setSaving(true);
    const { error } = await setGameDate(colonyId, value.cycle, value.day);
    setSaving(false);
    if (error) return toast.error(`Couldn't start the game clock: ${error.message}`);
    toast.success("Game clock started");
    navigate(`/colonies/${colonyId}/trackers/clock`);
  }

  return (
    <div>
      <BackLink colonyId={colony.id} name={colony.name} />
      <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Start the game clock</h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-soft">
        Set it like a clock on the wall: tell us the date the game's calendar shows right now. A Chronometer then moves
        it on every game day.
      </p>

      <section className="mt-10 max-w-xl">
        <h2 className="text-2xl font-bold tracking-tight">What does the game show now?</h2>
        <div className="mt-4">
          <DateSetter cycle={value.cycle} day={value.day} onChange={setValue} />
        </div>
        {!weather && (
          <p className="mt-4 rounded-lg bg-resin-soft/60 px-3 py-2 text-sm text-ink">
            Cycles move on when temperate weather starts, which needs weather tracking. You can add it afterwards.
          </p>
        )}
        <Button size="lg" onClick={start} disabled={saving} className="mt-8 h-11 px-5 text-base">
          {saving ? "Starting…" : "Start the game clock"}
        </Button>
      </section>
    </div>
  );
}

function WeatherTrackerNew({ colonyId }: { colonyId: string }) {
  const navigate = useNavigate();
  const [colony] = useColony(colonyId);
  const [exists] = useWeatherTracker(colonyId);
  const [saving, setSaving] = useState(false);

  if (colony === undefined || exists === undefined) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (colony === null) return <p className="text-ink-soft">Colony not found.</p>;
  if (exists) return <Navigate to={`/colonies/${colony.id}/trackers/weather`} replace />;

  async function start() {
    setSaving(true);
    const { error } = await supabase.from("weather_trackers").insert({ colony_id: colonyId });
    setSaving(false);
    if (error && error.code !== "23505") return toast.error(`Couldn't start weather tracking: ${error.message}`);
    toast.success("Weather tracking started");
    navigate(`/colonies/${colonyId}/trackers/weather`);
  }

  return (
    <div>
      <BackLink colonyId={colony.id} name={colony.name} />
      <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Track the weather</h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-soft">
        Each Weather Station switches on while its weather is happening. The station that switched on last tells
        smartbeavers which weather your colony is in.
      </p>

      <section className="mt-10 max-w-xl">
        <h2 className="text-2xl font-bold tracking-tight">You'll build 3 stations and 3 adapters</h2>
        <ul className="mt-4 divide-y rounded-xl border bg-paper">
          {WEATHERS.map((w) => (
            <li key={w.key} className="flex items-center gap-3 px-4 py-3">
              <WeatherBadge weather={w.key} />
              <span className="flex-1">Weather Station set to <strong>{w.stationSetting}</strong></span>
              <span className="font-mono text-[13px] text-ink-soft">{w.adapter}</span>
            </li>
          ))}
        </ul>
        <Button size="lg" onClick={start} disabled={saving} className="mt-8 h-11 px-5 text-base">
          {saving ? "Starting…" : "Start tracking weather"}
        </Button>
      </section>
    </div>
  );
}

function CounterTrackerForm({ kind }: { kind: Metric["kind"] }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [colony] = useColony(id);
  const ladders = useLadders(id);

  const [prefix, setPrefix] = useState<string>();
  const [comparison, setComparison] = useState<Comparison>("gte");
  const [saving, setSaving] = useState(false);

  if (colony === undefined || ladders === undefined) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (colony === null) return <p className="text-ink-soft">Colony not found.</p>;

  const taken = new Set(ladders.map((l) => l.metric));
  const resource = kind === "resource";
  const example = resource ? 50 : 30;
  const offered = new Set(goodsFor(colony.faction).map((g) => g.prefix));
  const available = (resource ? RESOURCE_METRICS.filter((m) => offered.has(m.prefix)) : METRICS).filter((m) => !taken.has(m.prefix));
  if (available.length === 0) {
    return (
      <div className="py-6">
        <BackLink colonyId={colony.id} name={colony.name} />
        <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Everything is tracked</h1>
        <p className="mt-3 text-ink-soft">This colony already has a tracker for everything a {resource ? "Resource" : "Population"} Counter can count.</p>
      </div>
    );
  }

  const metric = metricFor(prefix && !taken.has(prefix) ? prefix : available[0].prefix);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase
      .from("ladders")
      .insert({ colony_id: colony!.id, metric: metric.prefix, comparison })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? `${metric.label} is already tracked in this colony.` : `Couldn't create the tracker: ${error.message}`);
      return;
    }
    toast.success(`${metric.label} tracker created`);
    navigate(`/colonies/${colony!.id}/trackers/${data.id}`);
  }

  return (
    <div>
      <BackLink colonyId={colony.id} name={colony.name} />
      <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{resource ? "Track a resource" : "Track your population"}</h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-soft">
        {resource
          ? "Each Resource Counter switches on at one fill level, such as 50% full. Every time your storage passes one, smartbeavers knows the level at that moment. Build as many or as few as you like, and add more later."
          : "Each Population Counter switches on at one number. Every time your colony passes one, smartbeavers knows the number at that moment. Build as many or as few as you like, at any numbers, and add more later."}
      </p>

      <form onSubmit={save} className="mt-10 grid gap-12 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-10">
          {resource ? (
            <GoodPicker colonyId={colony.id} faction={colony.faction} available={available} value={metric.prefix} onChange={setPrefix} />
          ) : (
          <div className="space-y-2">
            <Label htmlFor="metric" className="text-base">What to count</Label>
            <Select value={metric.prefix} onValueChange={setPrefix}>
              <SelectTrigger id="metric" className="h-11 w-full max-w-xs bg-paper text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRIC_GROUPS.map((group) => {
                  const items = available.filter((m) => m.group === group);
                  if (items.length === 0) return null;
                  return (
                    <SelectGroup key={group}>
                      <SelectLabel>{group}</SelectLabel>
                      {items.map((m) => (
                        <SelectItem key={m.prefix} value={m.prefix}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-sm text-ink-soft">
              In the counter's list this is <strong className="font-medium text-ink">{metric.counterSetting}</strong>.
            </p>
          </div>
          )}

          <fieldset className="space-y-3">
            <legend className="text-base font-medium">How your counters compare</legend>
            <RadioGroup value={comparison} onValueChange={(v) => setComparison(v as Comparison)} className="grid max-w-md grid-cols-2 gap-3">
              {(["gte", "gt"] as const).map((c) => (
                <Label
                  key={c}
                  htmlFor={`cmp-${c}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border bg-paper p-4 font-normal transition-colors has-focus-visible:ring-2 has-focus-visible:ring-cobalt",
                    comparison === c && "border-cobalt bg-cobalt-soft/50",
                  )}
                >
                  <RadioGroupItem id={`cmp-${c}`} value={c} className="sr-only" />
                  <span className="font-display text-3xl leading-none font-bold">{comparisonSymbol(c)}</span>
                  <span className="text-sm leading-snug">{c === "gte" ? "Greater than or equal" : "Strictly greater than"}</span>
                </Label>
              ))}
            </RadioGroup>
            <p className="text-sm text-ink-soft">Pick whichever you like, then set every counter in this tracker the same way.</p>
          </fieldset>

          <Button type="submit" size="lg" disabled={saving} className="h-11 px-5 text-base">
            {saving ? "Creating…" : "Create tracker"}
          </Button>
        </div>

        <aside className="order-first lg:order-none">
          <div className="rounded-2xl bg-pine p-6 text-mist lg:sticky lg:top-8">
            <div className="text-sm text-sage">How adapters are named</div>
            <div className="mt-3 font-mono text-3xl leading-none font-bold">
              {metric.prefix}
              <span className="text-resin">{example}</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-sage">
              <span className="font-mono">{metric.prefix}</span> plus the counter's number. A counter set to{" "}
              {comparisonSymbol(comparison)} {example}{resource ? "%" : ""} gets an adapter named{" "}
              <span className="font-mono break-all">{adapterName(metric.prefix, example)}</span>.
              There's no list to fill in here: counters show up as they report.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function GoodPicker({
  colonyId,
  faction,
  available,
  value,
  onChange,
}: {
  colonyId: string;
  faction: string | null;
  available: Metric[];
  value: string;
  onChange: (prefix: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const open = new Set(available.map((m) => m.prefix));
  const shown = goodsFor(faction).filter((g) => open.has(g.prefix) && (!q || g.label.toLowerCase().includes(q)));

  return (
    <fieldset className="space-y-4">
      <legend className="text-base font-medium">Which good</legend>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search goods"
        aria-label="Search goods"
        className="h-11 max-w-xs bg-paper text-base"
      />
      <p className="text-sm text-ink-soft">
        {factionLabel(faction) ? `Showing ${factionLabel(faction)} goods.` : "Showing both factions' goods."}{" "}
        <Link to={`/colonies/${colonyId}?tab=settings`} className="text-cobalt-deep hover:underline">
          {factionLabel(faction) ? "Change faction" : "Set this colony's faction"}
        </Link>
      </p>
      {shown.length === 0 && <p className="text-sm text-ink-soft">No good matches "{query}".</p>}
      <RadioGroup value={value} onValueChange={onChange} className="block space-y-5">
        {GOOD_GROUPS.map((group) => {
          const items = shown.filter((g) => g.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className="text-sm text-ink-soft">{group}</div>
              <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2">
                {items.map((g) => (
                  <Label
                    key={g.prefix}
                    htmlFor={`good-${g.prefix}`}
                    title={g.faction ? `${g.label} (${g.faction})` : g.label}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border bg-paper px-3 py-2 text-sm leading-tight font-normal transition-colors has-focus-visible:ring-2 has-focus-visible:ring-cobalt",
                      value === g.prefix && "border-cobalt bg-cobalt-soft/50",
                    )}
                  >
                    <RadioGroupItem id={`good-${g.prefix}`} value={g.prefix} className="sr-only" />
                    <GoodIcon good={g.prefix} />
                    <span className="min-w-0">{g.label}</span>
                  </Label>
                ))}
              </div>
            </div>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}

export function BackLink({ colonyId, name }: { colonyId: string; name: string }) {
  return (
    <Link to={`/colonies/${colonyId}`} className="inline-flex items-center gap-1.5 text-sm text-cobalt-deep hover:underline">
      <ArrowLeft className="size-4" /> {name}
    </Link>
  );
}
