import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { SignalMeter } from "@/components/SignalMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { useColony, useLadders } from "@/lib/useColony";
import { cn } from "@/lib/utils";
import {
  METRICS,
  adapterName,
  comparisonSymbol,
  generateThresholds,
  lowerBound,
  metricFor,
  readSteps,
  type Comparison,
} from "@/shared/ladders";

export function TrackerNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [colony] = useColony(id);
  const ladders = useLadders(id);

  const [prefix, setPrefix] = useState<string>();
  const [comparison, setComparison] = useState<Comparison>("gte");
  const [from, setFrom] = useState(10);
  const [to, setTo] = useState(100);
  const [step, setStep] = useState(10);
  const [saving, setSaving] = useState(false);

  if (colony === undefined || ladders === undefined) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (colony === null) return <p className="text-ink-soft">Colony not found.</p>;

  const taken = new Set(ladders.map((l) => l.metric));
  const available = METRICS.filter((m) => !taken.has(m.prefix));
  if (available.length === 0) {
    return (
      <div className="py-6">
        <BackLink colonyId={colony.id} name={colony.name} />
        <h1 className="mt-4 text-5xl font-extrabold">Every metric is tracked</h1>
        <p className="mt-3 text-ink-soft">This colony already has a tracker for everything a Population Counter can count.</p>
      </div>
    );
  }

  const metric = metricFor(prefix && !taken.has(prefix) ? prefix : available[0].prefix);
  const thresholds = generateThresholds(from, to, step);
  const valid = typeof thresholds !== "string";

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("ladders")
      .insert({ colony_id: colony!.id, metric: metric.prefix, comparison, thresholds })
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
      <h1 className="mt-4 text-4xl leading-none font-extrabold sm:text-5xl">New tracker</h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-soft">
        Each Population Counter switches on at one number. With several of them, smartbeavers can tell which numbers
        your colony has passed. More counters give a more precise reading.
      </p>

      <form onSubmit={save} className="mt-10 grid gap-12 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-10">
          <div className="space-y-2">
            <Label htmlFor="metric" className="text-base">What to count</Label>
            <Select value={metric.prefix} onValueChange={setPrefix}>
              <SelectTrigger id="metric" className="h-11 w-full max-w-xs bg-paper text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {available.map((m) => (
                  <SelectItem key={m.prefix} value={m.prefix}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                  <span className="font-display text-4xl leading-none font-black">{comparisonSymbol(c)}</span>
                  <span className="text-sm leading-snug">{c === "gte" ? "Greater than or equal" : "Strictly greater than"}</span>
                </Label>
              ))}
            </RadioGroup>
            <p className="text-sm text-ink-soft">Pick whichever you like, then set every counter in this tracker the same way.</p>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-base font-medium">Which numbers to mark</legend>
            <div className="flex flex-wrap gap-4">
              <NumberField id="from" label="From" value={from} onChange={setFrom} min={0} />
              <NumberField id="to" label="To" value={to} onChange={setTo} min={0} />
              <NumberField id="every" label="Every" value={step} onChange={setStep} min={1} />
            </div>
            {!valid && <p role="alert" className="text-sm text-danger">{thresholds}</p>}
          </fieldset>

          {valid && (
            <section className="space-y-3">
              <h2 className="text-3xl font-bold">You'll build {thresholds.length} counters and {thresholds.length} adapters</h2>
              <p className="text-sm text-ink-soft">Name the adapters exactly like this. Capital letters matter.</p>
              <ul className="flex flex-wrap gap-2">
                {thresholds.map((t) => (
                  <li key={t} className="rounded-lg border bg-paper px-2.5 py-1 text-[13px]">
                    <span className="font-mono">{adapterName(metric.prefix, t)}</span>
                    <span className="ml-2 text-ink-soft">{comparisonSymbol(comparison)} {t}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Button type="submit" size="lg" disabled={saving || !valid} className="h-11 px-5 text-base">
            {saving ? "Creating…" : "Create tracker"}
          </Button>
        </div>

        <aside className="order-first lg:order-none">
          <div className="rounded-2xl bg-pine p-6 text-mist lg:sticky lg:top-8">
            <div className="text-sm text-sage">Preview</div>
            {valid ? <Preview thresholds={thresholds} comparison={comparison} unit={metric.unit} /> : <p className="mt-4 text-sage">Fix the numbers to see a preview.</p>}
          </div>
        </aside>
      </form>
    </div>
  );
}

function Preview({ thresholds, comparison, unit }: { thresholds: number[]; comparison: Comparison; unit: string }) {
  const bounds = thresholds.map((t) => lowerBound(t, comparison));
  const midIndex = Math.floor((bounds.length - 1) / 2);
  const marks = bounds.map((bound, i) => ({ bound, state: i <= midIndex }));
  const reading = readSteps(marks);
  const label = reading.kind === "range" ? (reading.max === null ? `${reading.min}+` : `${reading.min}–${reading.max}`) : "";

  return (
    <div className="mt-3">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-5xl leading-none font-black tabular-nums">{label}</span>
        <span className="text-sage">{unit}</span>
      </div>
      <SignalMeter steps={marks} tone="dark" className="mt-5" />
      <p className="mt-4 text-sm leading-relaxed text-sage">
        Example: the first {midIndex + 1} counters are on, so the dashboard shows {label}.
      </p>
    </div>
  );
}

function NumberField({ id, label, value, onChange, min }: { id: string; label: string; value: number; onChange: (n: number) => void; min: number }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-normal text-ink-soft">{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="h-11 w-28 bg-paper text-base tabular-nums"
      />
    </div>
  );
}

export function BackLink({ colonyId, name }: { colonyId: string; name: string }) {
  return (
    <Link to={`/colonies/${colonyId}`} className="inline-flex items-center gap-1.5 text-sm text-cobalt-deep hover:underline">
      <ArrowLeft className="size-4" /> {name}
    </Link>
  );
}
