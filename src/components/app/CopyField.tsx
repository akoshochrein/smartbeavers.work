import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function copyText(text: string, what: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied`),
    () => toast.error(`Couldn't copy. Select the text and copy it by hand.`),
  );
}

/** A read-only value players paste into the game, with a copy button. */
export function CopyField({ value, label, what }: { value: string; label: string; what: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex items-stretch overflow-hidden rounded-lg border bg-paper focus-within:ring-2 focus-within:ring-cobalt/40">
        <input
          readOnly
          value={value}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-[13px] text-ink outline-none"
        />
        <Button
          type="button"
          variant="ghost"
          className={cn("h-auto rounded-none border-l px-3", done && "text-cobalt-deep")}
          onClick={() => {
            copyText(value, what);
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          }}
        >
          {done ? <Check /> : <Copy />}
          <span className="sr-only sm:not-sr-only">{done ? "Copied" : "Copy"}</span>
        </Button>
      </div>
    </div>
  );
}
