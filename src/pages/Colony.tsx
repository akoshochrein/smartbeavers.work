import { CalendarClock, Plug, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { CopyField } from "@/components/app/CopyField";
import { StatusDot } from "@/components/app/StatusDot";
import { TrackerCard } from "@/components/app/TrackerCard";
import { ExportButton } from "@/components/app/ExportButton";
import { exportColony } from "@/lib/export";
import { FactionPicker } from "@/components/app/FactionPicker";
import type { FactionKey } from "@/shared/goods";
import { WeatherCard } from "@/components/app/WeatherCard";
import { GameClockCard, useDateVersion } from "@/components/app/GameClockCard";
import { useGameClock, useGameDate } from "@/lib/clock";
import { formatGameDate } from "@/shared/clock";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useColonies } from "@/lib/colonies";
import { supabase, type Colony } from "@/lib/supabase";
import { formatTime, timeAgo } from "@/lib/time";
import { createGameClient, type Adapter, type GameClient, type Lever } from "@/lib/timberborn";
import { useColony, useLadders, useWeatherTracker } from "@/lib/useColony";
import { useRecentSignals } from "@/lib/history";
import { useColonyFeed, type ColonyFeed } from "@/lib/useColonyFeed";
import { webhookUrl } from "@/shared/webhook";

export const COLONY_TABS = ["trackers", "signals", "levers", "settings"] as const;
export type ColonyTab = (typeof COLONY_TABS)[number];
const ROUTE = "/_app/colonies/$id/";
const LIVE_MS = 10 * 60_000;

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
  const [weather] = useWeatherTracker(colony.id);
  const [clock] = useGameClock(colony.id);
  const dateVersion = useDateVersion(feed);
  const [dateSets, setDateSets] = useState(0);
  const date = useGameDate(colony.id, !!clock, `${dateVersion}-${dateSets}`);
  const navigate = useNavigate();
  const tab = useSearch({ from: ROUTE }).tab ?? "trackers";

  const lastSignal = [...feed.states.values()].map((s) => s.updated_at).sort().at(-1);
  const live = !!lastSignal && Date.now() - Date.parse(lastSignal) < LIVE_MS;

  return (
    <div>
      <header className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl break-words">{colony.name}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-soft">
            {date && (
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                <CalendarClock className="size-4 text-ink-soft" /> {formatGameDate(date.cycle, date.day)}
              </span>
            )}
            {feed.loading ? (
              " "
            ) : (
              <span className="inline-flex items-center gap-2">
                <StatusDot state={lastSignal ? true : undefined} live={live} />
                {lastSignal ? `Last signal ${timeAgo(lastSignal)}` : "No signals yet. Connect an adapter to get started."}
              </span>
            )}
          </p>
        </div>
        <Button asChild className="sm:ml-auto">
          <Link to="/colonies/$id/trackers/new" params={{ id: colony.id }}>
            <Plus /> Add tracker
          </Link>
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => navigate({ to: "/colonies/$id", params: { id: colony.id }, search: v === "trackers" ? {} : { tab: v as ColonyTab }, replace: true })} className="mt-8">
        <TabsList variant="line" className="w-full justify-start gap-4 border-b pb-0">
          {[
            ["trackers", "Trackers"],
            ["signals", "Signals"],
            ["levers", "Levers"],
            ["settings", "Settings"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="flex-none px-1 pb-2 text-[15px] after:bg-cobalt">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="trackers" className="pt-8">
          {ladders === undefined || weather === undefined || clock === undefined ? (
            <Skeleton className="h-80 w-full rounded-2xl" />
          ) : ladders.length === 0 && !weather && !clock ? (
            <NoTrackers colonyId={colony.id} />
          ) : (
            <TrackerColumns
              cards={[
                clock && {
                  key: "clock",
                  weight: 1,
                  node: <GameClockCard colonyId={colony.id} feed={feed} date={date} onDateSet={() => setDateSets((n) => n + 1)} />,
                },
                weather && {
                  key: "weather",
                  weight: 2,
                  node: (
                    <WeatherCard
                      colonyId={colony.id}
                      feed={feed}
                      clockFrom={date?.first_day_at ? Date.parse(date.first_day_at) : undefined}
                      dayVersion={dateVersion}
                    />
                  ),
                },
                ...ladders.map((l) => ({ key: l.id, weight: 1.4, node: <TrackerCard ladder={l} feed={feed} clock={!!clock} dayVersion={dateVersion} /> })),
              ].filter((c) => !!c)}
            />
          )}
        </TabsContent>
        <TabsContent value="signals" className="pt-8">
          <SignalsTab colony={colony} feed={feed} />
        </TabsContent>
        <TabsContent value="levers" className="pt-8">
          <LeversTab colony={colony} />
        </TabsContent>
        <TabsContent value="settings" className="pt-8">
          <SettingsTab colony={colony} onChange={onChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type TrackerTile = { key: string; /** Rough relative height, used to balance the columns. */ weight: number; node: ReactNode };

/**
 * Two columns on wide screens, each card going into whichever column is shorter so far, so a
 * tall card doesn't leave a hole next to it. On narrow screens the columns dissolve and the
 * cards stack in their original order.
 */
function TrackerColumns({ cards }: { cards: TrackerTile[] }) {
  const columns: { height: number; items: { tile: TrackerTile; order: number }[] }[] = [
    { height: 0, items: [] },
    { height: 0, items: [] },
  ];
  cards.forEach((tile, order) => {
    const col = columns[1].height < columns[0].height ? columns[1] : columns[0];
    col.items.push({ tile, order });
    col.height += tile.weight;
  });
  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      {columns.map((col, i) => (
        <div key={i} className="contents xl:flex xl:min-w-0 xl:flex-1 xl:flex-col xl:gap-6">
          {col.items.map(({ tile, order }) => (
            <div key={tile.key} style={{ order }} className="min-w-0">
              {tile.node}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function NoTrackers({ colonyId }: { colonyId: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/20 p-8">
      <div className="max-w-md">
        <h2 className="text-2xl font-bold tracking-tight">Add your first tracker</h2>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Follow the weather with three Weather Stations, keep the game's date with a Chronometer, or turn a few
          counters into a number such as your population, free beds or how full your water storage is.
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

function SignalsTab({ colony, feed }: { colony: Colony; feed: ColonyFeed }) {
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

/** Talks directly to the game on the player's machine (browser → localhost). */
function LeversTab({ colony }: { colony: Colony }) {
  const game = useMemo(() => createGameClient(colony.api_base_url), [colony.api_base_url]);
  const [levers, setLevers] = useState<Lever[]>([]);
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [error, setError] = useState<string>();
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [l, a] = await Promise.all([game.levers(), game.adapters()]);
      setLevers(l);
      setAdapters(a);
      setConnected(true);
      setError(undefined);
    } catch (err) {
      setConnected(false);
      setError((err as Error).message);
    }
  }, [game]);

  useEffect(() => {
    if (!connected) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [connected, refresh]);

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight">Levers on this computer</h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
        While Timberborn runs on this computer, you can switch its HTTP Levers from here. Your browser talks to{" "}
        <code className="font-mono text-[13px] text-ink">{game.baseUrl}</code> directly, so this only works on the
        machine running the game.
      </p>
      {!connected && <StartApiNote className="mt-4 max-w-xl" />}

      {!connected && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await refresh();
              setBusy(false);
            }}
          >
            <Plug /> {busy ? "Connecting…" : "Connect to the game"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      {connected && (
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <section>
            <div className="flex items-center">
              <h3 className="text-xl font-semibold">HTTP Levers</h3>
              <Button size="icon-sm" variant="ghost" className="ml-auto" onClick={refresh} aria-label="Refresh">
                <RefreshCw />
              </Button>
            </div>
            {levers.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No HTTP Levers in this colony yet.</p>
            ) : (
              <ul className="mt-2 divide-y rounded-xl border bg-paper">
                {levers.map((l) => (
                  <LeverRow key={l.name} lever={l} game={game} onChanged={refresh} />
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-xl font-semibold">HTTP Adapters</h3>
            {adapters.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No HTTP Adapters in this colony yet.</p>
            ) : (
              <ul className="mt-2 divide-y rounded-xl border bg-paper">
                {adapters.map((a) => (
                  <li key={a.name} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <StatusDot state={a.state} />
                    <span className="font-mono text-[13px]">{a.name}</span>
                    <span className="ml-auto text-ink-soft">{a.state ? "On" : "Off"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function LeverRow({ lever, game, onChanged }: { lever: Lever; game: GameClient; onChanged: () => void }) {
  const [pending, setPending] = useState<boolean>();
  const checked = pending ?? lever.state;

  async function toggle(next: boolean) {
    setPending(next);
    try {
      const result = await (next ? game.switchOn(lever.name) : game.switchOff(lever.name));
      if (result === "sent") toast(`Sent to ${lever.name}. The game didn't confirm, so check it in-game.`);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(undefined);
    }
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <label htmlFor={`lever-${lever.name}`} className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[13px]">{lever.name}</span>
        {lever.springReturn && <span className="text-xs text-ink-soft">Springs back after a moment</span>}
      </label>
      <Switch id={`lever-${lever.name}`} checked={checked} disabled={pending !== undefined} onCheckedChange={toggle} />
    </li>
  );
}

function SettingsTab({ colony, onChange }: { colony: Colony; onChange: (c: Colony) => void }) {
  const navigate = useNavigate();
  const { reload } = useColonies();
  const [name, setName] = useState(colony.name);
  const [apiUrl, setApiUrl] = useState(colony.api_base_url);
  const [faction, setFaction] = useState<FactionKey | undefined>((colony.faction as FactionKey | null) ?? undefined);
  const dirty = name.trim() !== colony.name || apiUrl.trim() !== colony.api_base_url || (faction ?? null) !== colony.faction;

  async function save(e: FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from("colonies")
      .update({ name: name.trim(), api_base_url: apiUrl.trim(), faction: faction ?? null })
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
            Keep it friendly: with a public profile, colony names show on the colony ladder. The{" "}
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
        <div className="space-y-2">
          <Label htmlFor="api-url">Game address</Label>
          <Input id="api-url" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="bg-paper font-mono text-[13px]" />
          <p className="text-sm text-ink-soft">Only change this if you set a different port on an HTTP Lever in-game.</p>
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
              One JSON file with this colony's settings, trackers and full signal history. It includes the adapter
              links, so treat the file as private.
            </p>
          </div>
          <ExportButton run={() => exportColony(colony)} className="sm:ml-auto" />
        </div>
        <SettingsAction
          title="Make new adapter links"
          body="Use this if your links leaked. The old links stop working straight away, and you'll need to paste the new ones into every adapter."
          action="Make new links"
          confirmTitle="Make new adapter links?"
          confirmBody="Every adapter in this colony stops reporting until you paste the new links into it."
          onConfirm={rotate}
        />
        <SettingsAction
          title="Delete this colony"
          body="Removes the colony, its trackers and its signal history. Adapters in the game keep calling, but nothing is recorded."
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
