import { Plus } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { CopyField } from "@/components/app/CopyField";
import { StatusBand } from "@/components/app/StatusBand";
import { StatusDot } from "@/components/app/StatusDot";
import { POPULATION_BLOCK_METRICS, PopulationBlock } from "@/components/app/PopulationBlock";
import { TrackerTile } from "@/components/app/TrackerTile";
import { ExportButton } from "@/components/app/ExportButton";
import { exportColony } from "@/lib/export";
import { FactionPicker } from "@/components/app/FactionPicker";
import { ModGoods } from "@/components/app/ModGoods";
import { goodsFor, type FactionKey } from "@/shared/goods";
import { metricFor } from "@/shared/ladders";
import { TimeWeatherBlock, useDateVersion } from "@/components/app/TimeWeatherBlock";
import { useGameClock, useGameDate } from "@/lib/clock";
import { SignalMeter } from "@/components/SignalMeter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StartApiNote } from "@/components/app/StartApiNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useColonies } from "@/lib/colonies";
import { supabase, type Colony } from "@/lib/supabase";
import { formatTime, timeAgo } from "@/lib/time";
import { useColony, useLadders, useWeatherTracker } from "@/lib/useColony";
import { useRecentSignals } from "@/lib/history";
import { withModSignals } from "@/lib/modSignals";
import { isReporting, useColonyReadings, useModStatus, usePinnedMetrics, type ModStatus } from "@/lib/readings";
import { useColonyFeed, type ColonyFeed } from "@/lib/useColonyFeed";
import { modUrl, webhookUrl } from "@/shared/webhook";

export const COLONY_TABS = ["trackers", "signals", "settings"] as const;
export type ColonyTab = (typeof COLONY_TABS)[number];
const ROUTE = "/_app/colonies/$id/";
/** Metrics that get a card as soon as the companion mod reports them, with no tracker set up. */
const MOD_METRICS = ["Pop", "Bots"];

export function ColonyPage() {
  const { id } = useParams({ from: ROUTE });
  const [colony, setColony] = useColony(id);

  if (colony === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-80" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }
  if (colony === null) {
    return (
      <div className="py-10">
        <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Colony not found</h1>
        <p className="mt-3 text-ink-soft">It may have been deleted, or it belongs to another account.</p>
        <Button asChild variant="link" className="mt-2 px-0">
          <Link to="/dashboard">Back to your colonies</Link>
        </Button>
      </div>
    );
  }
  return <ColonyDashboard key={colony.id} colony={colony} onChange={setColony} />;
}

function ColonyDashboard({ colony, onChange }: { colony: Colony; onChange: (c: Colony) => void }) {
  const feed = useColonyFeed(colony.id);
  const ladders = useLadders(colony.id);
  const readings = useColonyReadings(colony.id);
  const [pinned, setPinned] = usePinnedMetrics(colony.id);
  const mod = useModStatus(colony.id);
  // Goods the mod reports storage for and the player hasn't set a tracker up for.
  const modGoods = goodsFor(colony.faction).filter((g) => readings?.byMetric.has(g.prefix) && !ladders?.some((l) => l.metric === g.prefix));
  // Trackers the mod feeds on its own: the default metrics and pinned goods it has reported,
  // unless the player set a tracker up for the same thing (then that card shows the mod's value).
  const autoTrackers = [...MOD_METRICS, ...modGoods.map((g) => g.prefix).filter((m) => pinned?.has(m))].filter((m) => readings?.byMetric.has(m) && !ladders?.some((l) => l.metric === m)).map((metric) => ({
    id: `mod-${metric}`,
    colony_id: colony.id,
    metric,
    comparison: "gte",
  }));
  const [weatherTracker] = useWeatherTracker(colony.id);
  const [clockSetUp] = useGameClock(colony.id);
  const [dateSets, setDateSets] = useState(0);
  // One tile is open at a time, across every section.
  const [openTile, setOpenTile] = useState<string>();
  const navigate = useNavigate();
  const tab = useSearch({ from: ROUTE }).tab ?? "trackers";

  // Weather and the date can come from the mod instead of Weather Stations and a Chronometer.
  // The weather and clock cards get a feed with the mod's readings folded in; undefined = loading.
  const modFeed = useMemo(() => withModSignals(feed, readings), [feed, readings]);
  const modWeather = readings?.byMetric.has("Weather");
  const modDate = readings?.byMetric.has("Cycle") && readings.byMetric.has("Day");
  const weather = weatherTracker === undefined || readings === undefined ? undefined : weatherTracker || !!modWeather;
  const clock = clockSetUp === undefined || readings === undefined ? undefined : !!clockSetUp || !!modDate;
  const dateVersion = useDateVersion(modFeed);
  const date = useGameDate(colony.id, !!clock, `${dateVersion}-${dateSets}`);

  const lastSignal = [...feed.states.values()].map((s) => s.updated_at).sort().at(-1);

  return (
    <div>
      <header className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl break-words">{colony.name}</h1>
        </div>
        <Button asChild className="sm:ml-auto">
          <Link to="/colonies/$id/trackers/new" params={{ id: colony.id }}>
            <Plus /> Add tracker
          </Link>
        </Button>
      </header>

      <StatusBand colonyId={colony.id} feed={modFeed} date={clock === undefined ? undefined : date} mod={mod} lastSignal={lastSignal} dayVersion={dateVersion} />

      <Tabs value={tab} onValueChange={(v) => navigate({ to: "/colonies/$id", params: { id: colony.id }, search: v === "trackers" ? {} : { tab: v as ColonyTab }, replace: true })} className="mt-6">
        <TabsList variant="line" className="w-full justify-start gap-4 border-b pb-0">
          {[
            ["trackers", "Trackers"],
            ["signals", "Signals"],
            ["settings", "Settings"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="flex-none px-1 pb-2 text-[15px] after:bg-cobalt">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="trackers" className="pt-8">
          {ladders === undefined || readings === undefined || pinned === undefined || weather === undefined || clock === undefined ? (
            <Skeleton className="h-80 w-full rounded-2xl" />
          ) : ladders.length === 0 && autoTrackers.length === 0 && !weather && !clock ? (
            <NoTrackers colonyId={colony.id} />
          ) : (
            (() => {
              const tile = (l: (typeof trackers)[number]) => (
                <TrackerTile
                  key={l.id}
                  ladder={l}
                  feed={feed}
                  reading={readings.byMetric.get(l.metric)}
                  readingsVersion={readings.version}
                  auto={l.auto}
                  clock={!!clock}
                  dayVersion={dateVersion}
                  open={openTile === l.id}
                  onToggle={() => setOpenTile(openTile === l.id ? undefined : l.id)}
                  onUnpin={l.auto && pinned.has(l.metric) ? () => setPinned(l.metric, false) : undefined}
                />
              );
              const trackers = [...autoTrackers.map((l) => ({ ...l, auto: true })), ...ladders.map((l) => ({ ...l, auto: false }))];
              const goods = trackers.filter((l) => metricFor(l.metric).kind === "resource");
              // A good is a tile or a line on the storage list, never both.
              const unpinnedGoods = modGoods.filter((g) => !pinned.has(g.prefix));
              // With a population to show, the block covers population and bots; other numbers stay tiles.
              const hasPopulation = trackers.some((l) => l.metric === "Pop");
              const numbers = trackers.filter((l) => metricFor(l.metric).kind !== "resource" && !(hasPopulation && POPULATION_BLOCK_METRICS.includes(l.metric)));
              return (
                <TrackerSections
                  time={
                    (clock || weather) && (
                      <TimeWeatherBlock
                        colonyId={colony.id}
                        feed={modFeed}
                        date={date}
                        clock={!!clock}
                        weather={!!weather}
                        clockAuto={!clockSetUp}
                        weatherAuto={!weatherTracker}
                        dayVersion={dateVersion}
                        onDateSet={() => setDateSets((n) => n + 1)}
                      />
                    )
                  }
                  population={
                    (hasPopulation || numbers.length > 0) && (
                      <div className="space-y-4">
                        {hasPopulation && <PopulationBlock colonyId={colony.id} feed={feed} readings={readings} ladders={ladders} clock={!!clock} dayVersion={dateVersion} />}
                        {numbers.length > 0 && <TileGrid>{numbers.map(tile)}</TileGrid>}
                      </div>
                    )
                  }
                  goods={
                    (goods.length > 0 || unpinnedGoods.length > 0) && (
                      <>
                        {goods.length > 0 && <TileGrid>{goods.map(tile)}</TileGrid>}
                        {unpinnedGoods.length > 0 && <ModGoods goods={unpinnedGoods} readings={readings.byMetric} onPin={setPinned} />}
                      </>
                    )
                  }
                />
              );
            })()
          )}
        </TabsContent>
        <TabsContent value="signals" className="max-w-6xl pt-8">
          <SignalsTab colony={colony} feed={feed} mod={mod} />
        </TabsContent>
        <TabsContent value="settings" className="pt-8">
          <SettingsTab colony={colony} onChange={onChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * The Trackers tab's sections, always in the same order: Time and weather, Population, Goods.
 * A section with nothing in it is left out. On wide screens Time and weather is a pane on the
 * left and the other two fill the right; on narrower screens they stack in that order.
 */
function TrackerSections({ time, population, goods }: { time: ReactNode; population: ReactNode; goods: ReactNode }) {
  const rest = (!!population || !!goods) && (
    <div className="min-w-0 space-y-8">
      {population && <Section title="Population">{population}</Section>}
      {goods && <Section title="Goods">{goods}</Section>}
    </div>
  );
  if (!time || !rest) return <div className={time ? "max-w-2xl" : undefined}>{time ? <Section title="Time and weather">{time}</Section> : rest}</div>;
  return (
    <div className="grid gap-8 xl:grid-cols-[26rem_minmax(0,1fr)] xl:items-start">
      {/* Pinned under the status band; scrolls inside itself if it is taller than the window. */}
      <div className="xl:sticky xl:top-32 xl:max-h-[calc(100dvh-9rem)] xl:overflow-y-auto">
        <Section title="Time and weather">{time}</Section>
      </div>
      {rest}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">{title}</h2>
      {children}
    </section>
  );
}

/** Tiles keep their own height, so opening one doesn't stretch the tiles beside it. */
function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid items-start gap-4 sm:grid-cols-2 2xl:grid-cols-3">{children}</div>;
}

function NoTrackers({ colonyId }: { colonyId: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/20 p-8">
      <div className="max-w-md">
        <h2 className="text-2xl font-bold tracking-tight">Add your first tracker</h2>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Follow the weather with three Weather Stations, keep the game's date with a Chronometer, or turn a few
          counters into a number such as your population, your bots or how full your water storage is.
        </p>
        <SignalMeter steps={[10, 20, 30, 40, 50].map((bound) => ({ bound, state: undefined }))} labels={false} size="sm" className="mt-5 max-w-xs" />
        <Button asChild className="mt-5">
          <Link to="/colonies/$id/trackers/new" params={{ id: colonyId }}>
            <Plus /> Add a tracker
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SignalsTab({ colony, feed, mod }: { colony: Colony; feed: ColonyFeed; mod: ModStatus | null | undefined }) {
  const origin = window.location.origin;
  const states = [...feed.states.values()].sort((a, b) => a.name.localeCompare(b.name));
  const events = useRecentSignals(colony.id, feed.live);
  // Rows that arrive after the page loaded get a short highlight.
  const firstSeenMax = useRef<number | null>(null);
  if (firstSeenMax.current === null && events) firstSeenMax.current = events[0]?.id ?? 0;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Adapter links</h2>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-soft">
            Paste these into every HTTP Adapter in this colony and tick both boxes. The game fills in{" "}
            <code className="font-mono text-[13px] text-ink">{"{name}"}</code> for you, and GET or POST both work.
          </p>
        </div>
        <CopyField label="Call when switched on" what="On link" value={webhookUrl(origin, colony.webhook_token, "on")} />
        <CopyField label="Call when switched off" what="Off link" value={webhookUrl(origin, colony.webhook_token, "off")} />
        <StartApiNote />

        <div className="space-y-4 border-t pt-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Companion mod</h2>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-soft">
              If you play with the smartbeavers companion mod, paste this address into the mod's box once for this save.
              The mod then reports this colony's numbers by itself, with no adapters to build.
            </p>
          </div>
          <CopyField label="Address for the companion mod" what="Mod address" value={modUrl(origin, colony.webhook_token)} />
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <StatusDot state={mod ? true : undefined} live={isReporting(mod)} />
            {mod === undefined
              ? " "
              : isReporting(mod)
                ? "The mod is reporting right now."
                : mod
                  ? `The mod last reported ${timeAgo(mod.lastSeen)}.`
                  : "The mod hasn't reported for this colony yet."}
          </p>
          <p className="max-w-md text-sm leading-relaxed text-ink-soft">
            The address holds the same secret as the adapter links, and the mod keeps it in the save file. Before you
            share a save with someone, make new links in Settings, or their game will report to your colony.
          </p>
        </div>

        <div className="pt-4">
          <h2 className="text-2xl font-bold tracking-tight">Adapters</h2>
          {states.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Adapters appear here after their first signal.</p>
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Last change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {states.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-mono text-[13px]">{s.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <StatusDot state={s.state} /> {s.state ? "On" : "Off"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-ink-soft">{timeAgo(s.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold tracking-tight">Recent signals</h2>
        {events === undefined ? (
          <Skeleton className="mt-3 h-64 w-full" />
        ) : events.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Nothing yet. Signals show up here the moment an adapter calls.</p>
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Adapter</TableHead>
                <TableHead>Switched</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow
                  key={e.id}
                  className={
                    firstSeenMax.current !== null && e.id > firstSeenMax.current
                      ? "animate-in bg-resin-soft/60 duration-700 fade-in slide-in-from-top-2"
                      : undefined
                  }
                >
                  <TableCell className="whitespace-nowrap text-ink-soft">{formatTime(Date.parse(e.received_at))}</TableCell>
                  <TableCell className="font-mono text-[13px]">{e.adapter_name}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <StatusDot state={e.state} /> {e.state ? "On" : "Off"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function SettingsTab({ colony, onChange }: { colony: Colony; onChange: (c: Colony) => void }) {
  const navigate = useNavigate();
  const { reload } = useColonies();
  const [name, setName] = useState(colony.name);
  const [faction, setFaction] = useState<FactionKey | undefined>((colony.faction as FactionKey | null) ?? undefined);
  const dirty = name.trim() !== colony.name || (faction ?? null) !== colony.faction;

  async function save(e: FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from("colonies")
      .update({ name: name.trim(), faction: faction ?? null })
      .eq("id", colony.id)
      .select()
      .single();
    if (error) return toast.error(`Couldn't save: ${error.message}`);
    onChange(data);
    reload();
    toast.success("Settings saved");
  }

  async function rotate() {
    const { data, error } = await supabase.rpc("rotate_webhook_token", { p_colony: colony.id });
    if (error) return toast.error(`Couldn't make new links: ${error.message}`);
    onChange({ ...colony, webhook_token: data });
    toast.success("New links made. Paste them into your adapters.");
  }

  async function remove() {
    const { error } = await supabase.from("colonies").delete().eq("id", colony.id);
    if (error) return toast.error(`Couldn't delete: ${error.message}`);
    await reload();
    toast.success(`${colony.name} deleted`);
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="max-w-2xl space-y-12">
      <form onSubmit={save} className="space-y-5">
        <h2 className="text-2xl font-bold tracking-tight">Colony</h2>
        <div className="space-y-2">
          <Label htmlFor="colony-name">Name</Label>
          <Input id="colony-name" value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} className="bg-paper" />
          <p className="text-sm text-ink-soft">
            Keep it friendly: with a public profile, colony names show in the live colonies list. The{" "}
            <Link to="/terms" className="text-cobalt-deep underline-offset-4 hover:underline">
              terms
            </Link>{" "}
            say what's not allowed.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">Faction</div>
          <FactionPicker id="colony-faction" value={faction} onChange={setFaction} />
          <p className="text-sm text-ink-soft">
            {colony.faction
              ? "Decides which goods you're offered when you add a resource tracker. Trackers you already have stay."
              : "Not set yet, so you're offered both factions' goods. Pick one to narrow the list."}
          </p>
        </div>
        <Button type="submit" disabled={!dirty}>
          Save changes
        </Button>
      </form>

      <section className="space-y-6 border-t pt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="max-w-md">
            <h3 className="text-xl font-semibold">Export this colony</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              One JSON file with this colony's settings, trackers, and the signals and companion mod readings
              still stored for it. It includes the adapter links, so treat the file as private.
            </p>
          </div>
          <ExportButton run={() => exportColony(colony)} className="sm:ml-auto" />
        </div>
        <SettingsAction
          title="Make new adapter links"
          body="Use this if your links leaked. The old links stop working straight away, and you'll need to paste the new ones into every adapter. The companion mod is cut off too, until you paste its new address into it."
          action="Make new links"
          confirmTitle="Make new adapter links?"
          confirmBody="Every adapter in this colony, and the companion mod if you use it, stops reporting until you paste the new links in."
          onConfirm={rotate}
        />
        <SettingsAction
          title="Delete this colony"
          body="Removes the colony, its trackers and everything it has received. Adapters and the mod keep calling, but nothing is recorded."
          action="Delete colony"
          confirmTitle={`Delete ${colony.name}?`}
          confirmBody="This removes its trackers and signal history for good."
          destructive
          onConfirm={remove}
        />
      </section>
    </div>
  );
}

function SettingsAction(props: {
  title: string;
  body: string;
  action: string;
  confirmTitle: string;
  confirmBody: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="max-w-md">
        <h3 className="text-xl font-semibold">{props.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{props.body}</p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={props.destructive ? "destructive" : "outline"} className="sm:ml-auto">
            {props.action}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-bold tracking-tight">{props.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{props.confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={props.onConfirm}
              className={props.destructive ? "bg-danger text-white hover:bg-danger/90" : undefined}
            >
              {props.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
