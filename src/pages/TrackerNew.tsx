import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button, Card } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useColony, useLadders } from "../lib/useColony";
import {
  METRICS,
  adapterName,
  comparisonSymbol,
  generateThresholds,
  metricFor,
  type Comparison,
} from "../shared/ladders";

export function TrackerNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [colony] = useColony(id);
  const ladders = useLadders(id);

  const taken = new Set(ladders?.map((l) => l.metric));
  const available = METRICS.filter((m) => !taken.has(m.prefix));

  const [prefix, setPrefix] = useState<string>();
  const [comparison, setComparison] = useState<Comparison>("gte");
  const [from, setFrom] = useState(10);
  const [to, setTo] = useState(100);
  const [step, setStep] = useState(10);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  if (colony === undefined || ladders === undefined) return <p className="text-bark-500">Loading…</p>;
  if (colony === null) return <p className="text-bark-500">Colony not found.</p>;

  const metric = metricFor(prefix ?? available[0]?.prefix ?? "Pop");
  const thresholds = generateThresholds(from, to, step);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (typeof thresholds === "string") return;
    setSaving(true);
    const { data, error } = await supabase
      .from("ladders")
      .insert({ colony_id: colony!.id, metric: metric.prefix, comparison, thresholds })
      .select()
      .single();
    setSaving(false);
    if (error) return setError(error.code === "23505" ? `You already track ${metric.label} in this colony.` : error.message);
    navigate(`/colonies/${colony!.id}/trackers/${data.id}`);
  }

  if (available.length === 0) {
    return <p className="text-bark-500">You're already tracking every available metric in this colony.</p>;
  }

  const input = "w-24 rounded-md border border-bark-200 bg-white px-2 py-1 tabular-nums";

  return (
    <form onSubmit={save} className="space-y-6">
      <div>
        <Link to={`/colonies/${colony.id}`} className="text-sm text-river-700 hover:underline">← {colony.name}</Link>
        <h1 className="mt-1 text-2xl font-bold">New tracker</h1>
        <p className="mt-1 max-w-2xl text-bark-700">
          The game can only send on/off signals, so we measure a number with a row of Population Counters, each
          switching on at a different threshold. More counters means a more precise reading.
        </p>
      </div>

      <Card title="What to track">
        <div className="space-y-4 text-sm">
          <label className="block">
            <span className="mb-1 block text-xs text-bark-500">Metric</span>
            <select value={metric.prefix} onChange={(e) => setPrefix(e.target.value)} className="rounded-md border border-bark-200 bg-white px-2 py-1">
              {available.map((m) => <option key={m.prefix} value={m.prefix}>{m.label}</option>)}
            </select>
          </label>

          <fieldset>
            <legend className="mb-1 text-xs text-bark-500">Counter comparison (use the same on every counter)</legend>
            <div className="flex gap-4">
              {(["gte", "gt"] as const).map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <input type="radio" name="comparison" checked={comparison === c} onChange={() => setComparison(c)} />
                  <span className="font-mono">{comparisonSymbol(c)}</span>
                  {c === "gte" ? "greater or equal" : "strictly greater"}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-end gap-4">
            <label><span className="mb-1 block text-xs text-bark-500">From</span><input type="number" min={0} value={from} onChange={(e) => setFrom(e.target.valueAsNumber)} className={input} /></label>
            <label><span className="mb-1 block text-xs text-bark-500">To</span><input type="number" min={0} value={to} onChange={(e) => setTo(e.target.valueAsNumber)} className={input} /></label>
            <label><span className="mb-1 block text-xs text-bark-500">Every</span><input type="number" min={1} value={step} onChange={(e) => setStep(e.target.valueAsNumber)} className={input} /></label>
          </div>
        </div>
      </Card>

      <Card title="What you'll build">
        {typeof thresholds === "string" ? (
          <p className="text-sm text-ember-500">{thresholds}</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{thresholds.length}</strong> Population Counters and <strong>{thresholds.length}</strong> HTTP Adapters.
              The dashboard will read {metric.unit} to within {step}.
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {thresholds.map((t) => (
                <li key={t} className="rounded-md bg-bark-100 px-2 py-0.5 font-mono text-xs">
                  {adapterName(metric.prefix, t)} <span className="text-bark-500">{comparisonSymbol(comparison)} {t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {error && <p className="text-sm text-ember-500">{error}</p>}
      <Button type="submit" disabled={saving || typeof thresholds === "string"} className="px-4 py-2">
        {saving ? "Creating…" : "Create tracker and show setup guide"}
      </Button>
    </form>
  );
}
