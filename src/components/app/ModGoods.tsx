import { Pin, PinOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GoodIcon } from "@/components/app/GoodIcon";
import { Button } from "@/components/ui/button";
import type { Reading } from "@/lib/readings";
import type { Good } from "@/shared/goods";

/**
 * Every good the companion mod reports storage for, with a pin on each. Pinned goods get a
 * card of their own among the trackers; the rest stay in this list so the page isn't thirty
 * cards long.
 */
export function ModGoods({
  goods,
  readings,
  pinned,
  onPin,
}: {
  goods: Good[];
  readings: Map<string, Reading>;
  pinned: Set<string>;
  onPin: (metric: string, pinned: boolean) => Promise<string | undefined>;
}) {
  const [busy, setBusy] = useState<string>();

  async function toggle(good: Good) {
    const next = !pinned.has(good.prefix);
    setBusy(good.prefix);
    const error = await onPin(good.prefix, next);
    setBusy(undefined);
    if (error) toast.error(`Couldn't ${next ? "pin" : "unpin"} ${good.label}: ${error}`);
  }

  return (
    <section className="mt-10 rounded-2xl border bg-paper p-5 sm:p-6" aria-labelledby="mod-goods">
      <h2 id="mod-goods" className="text-xl font-semibold">
        Storage
      </h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
        How full storage is for each good, as the companion mod reports it. Pin a good to give it a card with a chart.
      </p>
      <ul className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
        {goods.map((good) => {
          const isPinned = pinned.has(good.prefix);
          return (
            <li key={good.prefix} className="flex items-center gap-2.5 py-1">
              <GoodIcon good={good.prefix} className="size-6 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{good.label}</span>
              <span className="font-medium tabular-nums">{readings.get(good.prefix)!.value}%</span>
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={isPinned}
                disabled={busy === good.prefix}
                onClick={() => toggle(good)}
                className={isPinned ? "text-cobalt-deep hover:text-cobalt-deep" : "text-ink-soft"}
              >
                {isPinned ? <PinOff /> : <Pin />}
                <span className="sr-only">
                  {isPinned ? "Unpin" : "Pin"} {good.label}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
