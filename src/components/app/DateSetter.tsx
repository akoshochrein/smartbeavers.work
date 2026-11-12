import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Two big numbers with − / + like setting a wall clock: the cycle and day the game shows. */
export function DateSetter({
  cycle,
  day,
  onChange,
}: {
  cycle: number;
  day: number;
  onChange: (next: { cycle: number; day: number }) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      <Dial label="Cycle" value={cycle} max={100000} onChange={(v) => onChange({ cycle: v, day })} />
      <Dial label="Day" value={day} max={1000} onChange={(v) => onChange({ cycle, day: v })} />
    </div>
  );
}

function Dial({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(1, Number.isFinite(v) ? Math.round(v) : 1)));
  const id = `dial-${label.toLowerCase()}`;
  return (
    <div className="rounded-2xl border bg-paper p-3">
      <label htmlFor={id} className="block px-1 text-sm text-ink-soft">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" onClick={() => set(value - 1)} aria-label={`${label} minus one`} disabled={value <= 1}>
          <Minus />
        </Button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={value}
          onChange={(e) => set(e.target.valueAsNumber)}
          className="w-24 [appearance:textfield] bg-transparent text-center font-display text-4xl font-bold tabular-nums outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-cobalt [&::-webkit-inner-spin-button]:appearance-none"
        />
        <Button type="button" variant="ghost" size="icon" onClick={() => set(value + 1)} aria-label={`${label} plus one`}>
          <Plus />
        </Button>
      </div>
    </div>
  );
}
