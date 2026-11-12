import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { FACTIONS, type FactionKey } from "@/shared/goods";

/** Two cards, one per faction. `value` is undefined until the player has picked. */
export function FactionPicker({ id, value, onChange }: { id: string; value: FactionKey | undefined; onChange: (f: FactionKey) => void }) {
  return (
    <RadioGroup value={value ?? ""} onValueChange={(v) => onChange(v as FactionKey)} aria-label="Faction" className="grid grid-cols-2 gap-3">
      {FACTIONS.map((f) => (
        <Label
          key={f.key}
          htmlFor={`${id}-${f.key}`}
          className={cn(
            "flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border bg-paper p-3.5 font-normal transition-colors has-focus-visible:ring-2 has-focus-visible:ring-cobalt",
            value === f.key && "border-cobalt bg-cobalt-soft/50",
          )}
        >
          <RadioGroupItem id={`${id}-${f.key}`} value={f.key} className="sr-only" />
          <span className="text-base font-semibold">{f.label}</span>
          <span className="text-sm leading-snug text-ink-soft">{f.hint}</span>
        </Label>
      ))}
    </RadioGroup>
  );
}
