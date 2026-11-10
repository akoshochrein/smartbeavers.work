import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button, Card, CopyField, StateDot } from "../components/ui";
import { supabase, type AdapterEvent, type AdapterState, type Colony } from "../lib/supabase";
import { createGameClient, type Adapter, type GameClient, type Lever } from "../lib/timberborn";
import { webhookUrl } from "../shared/webhook";

const POLL_MS = 2000;

export function ColonyPage() {
  const { id } = useParams<{ id: string }>();
  const [colony, setColony] = useState<Colony | null>();

  useEffect(() => {
    supabase.from("colonies").select("*").eq("id", id!).maybeSingle().then(({ data }) => setColony(data));
  }, [id]);

  if (colony === undefined) return <p className="text-bark-500">Loading…</p>;
  if (colony === null) return <p className="text-bark-500">Colony not found.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{colony.name}</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <LiveGamePanel colony={colony} />
        <WebhookPanel colony={colony} />
      </div>
      <SettingsPanel colony={colony} onChange={setColony} />
    </div>
  );
}

/** Talks directly to the game on the player's machine (browser → localhost). */
function LiveGamePanel({ colony }: { colony: Colony }) {
  const game = useMemo(() => createGameClient(colony.api_base_url), [colony.api_base_url]);
  const [levers, setLevers] = useState<Lever[]>([]);
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [error, setError] = useState<string>();
  const [connected, setConnected] = useState(false);

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
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [connected, refresh]);

  return (
    <Card
      title="Live from your game"
      actions={<Button onClick={refresh}>{connected ? "Refresh" : "Connect"}</Button>}
    >
      <p className="mb-3 text-xs text-bark-500">
        Your browser talks to <code className="font-mono">{game.baseUrl}</code> directly. Nothing here passes
        through our servers.
      </p>
      {error && <p className="mb-3 text-sm text-ember-500">{error}</p>}
      {connected && (
        <div className="space-y-4">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-bark-700">HTTP Levers</h3>
            {levers.length === 0 && <p className="text-sm text-bark-500">No levers found.</p>}
            <ul className="space-y-1">
              {levers.map((l) => (
                <LeverRow key={l.name} lever={l} game={game} onChanged={refresh} />
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-bark-700">HTTP Adapters</h3>
            {adapters.length === 0 && <p className="text-sm text-bark-500">No adapters found.</p>}
            <ul className="space-y-1">
              {adapters.map((a) => (
                <li key={a.name} className="flex items-center gap-2 text-sm">
                  <StateDot on={a.state} /> {a.name}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Card>
  );
}

function LeverRow({ lever, game, onChanged }: { lever: Lever; game: GameClient; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await (lever.state ? game.switchOff(lever.name) : game.switchOn(lever.name));
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex items-center gap-2 text-sm">
      <StateDot on={lever.state} />
      <span>{lever.name}</span>
      {lever.springReturn && <span className="text-xs text-bark-500">(spring)</span>}
      <Button className="ml-auto" disabled={busy} onClick={toggle}>
        {lever.state ? "Switch off" : "Switch on"}
      </Button>
    </li>
  );
}

/** Adapter signals that the game pushed to our Worker, streamed via Supabase Realtime. */
function WebhookPanel({ colony }: { colony: Colony }) {
  const [states, setStates] = useState<AdapterState[]>([]);
  const [events, setEvents] = useState<AdapterEvent[]>([]);

  useEffect(() => {
    const load = async () => {
      const [s, e] = await Promise.all([
        supabase.from("adapter_states").select("*").eq("colony_id", colony.id).order("name"),
        supabase
          .from("adapter_events")
          .select("*")
          .eq("colony_id", colony.id)
          .order("received_at", { ascending: false })
          .limit(20),
      ]);
      if (s.data) setStates(s.data);
      if (e.data) setEvents(e.data);
    };
    load();

    const channel = supabase
      .channel(`colony:${colony.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "adapter_events", filter: `colony_id=eq.${colony.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [colony.id]);

  const origin = window.location.origin;

  return (
    <Card title="Webhook inbox">
      <div className="mb-4 space-y-2 text-sm">
        <p className="text-bark-700">
          In each HTTP Adapter, tick both boxes and paste these URLs. The game fills in <code>{"{name}"}</code>.
          GET or POST both work.
        </p>
        <label className="block text-xs text-bark-500">Call when switched on</label>
        <CopyField value={webhookUrl(origin, colony.webhook_token, "on")} />
        <label className="block text-xs text-bark-500">Call when switched off</label>
        <CopyField value={webhookUrl(origin, colony.webhook_token, "off")} />
      </div>

      <h3 className="mb-2 text-sm font-semibold text-bark-700">Adapter states</h3>
      {states.length === 0 && <p className="text-sm text-bark-500">No signals received yet.</p>}
      <ul className="mb-4 space-y-1">
        {states.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-sm">
            <StateDot on={s.state} /> {s.name}
            <span className="ml-auto text-xs text-bark-500">{new Date(s.updated_at).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>

      <h3 className="mb-2 text-sm font-semibold text-bark-700">Recent events</h3>
      <ul className="max-h-60 space-y-1 overflow-y-auto font-mono text-xs">
        {events.map((e) => (
          <li key={e.id} className="flex gap-2">
            <span className="text-bark-500">{new Date(e.received_at).toLocaleTimeString()}</span>
            <span className={e.state ? "text-moss-500" : "text-bark-500"}>{e.state ? "ON " : "OFF"}</span>
            <span>{e.adapter_name}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SettingsPanel({ colony, onChange }: { colony: Colony; onChange: (c: Colony) => void }) {
  const navigate = useNavigate();
  const [apiUrl, setApiUrl] = useState(colony.api_base_url);
  const [error, setError] = useState<string>();

  async function saveUrl() {
    const { data, error } = await supabase
      .from("colonies")
      .update({ api_base_url: apiUrl.trim() })
      .eq("id", colony.id)
      .select()
      .single();
    if (error) setError(error.message);
    else onChange(data);
  }

  async function rotate() {
    if (!confirm("Old webhook URLs will stop working. You'll need to paste the new ones into every adapter.")) return;
    const { data, error } = await supabase.rpc("rotate_webhook_token", { p_colony: colony.id });
    if (error) setError(error.message);
    else onChange({ ...colony, webhook_token: data });
  }

  async function remove() {
    if (!confirm(`Delete "${colony.name}" and its event history?`)) return;
    const { error } = await supabase.from("colonies").delete().eq("id", colony.id);
    if (error) setError(error.message);
    else navigate("/dashboard");
  }

  return (
    <Card title="Settings">
      {error && <p className="mb-3 text-sm text-ember-500">{error}</p>}
      <div className="space-y-4 text-sm">
        <div>
          <label className="mb-1 block text-xs text-bark-500">Game API URL (set the port on an HTTP Lever in-game)</label>
          <div className="flex gap-2">
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-bark-200 bg-white px-2 py-1 font-mono text-xs"
            />
            <Button onClick={saveUrl} disabled={apiUrl === colony.api_base_url}>Save</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={rotate} className="bg-bark-500">Regenerate webhook URLs</Button>
          <Button onClick={remove} className="bg-ember-500 hover:bg-ember-500/80">Delete colony</Button>
        </div>
      </div>
    </Card>
  );
}
