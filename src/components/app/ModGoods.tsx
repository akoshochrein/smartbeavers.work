import { Pin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GoodIcon } from "@/components/app/GoodIcon";
import { Button } from "@/components/ui/button";
import type { Reading } from "@/lib/readings";
import type { Good } from "@/shared/goods";

/**
 * The goods the companion mod reports storage for that have no tile: each with how full its
 * storage is and a pin. Pinning a good gives it a tile with a chart and takes it off this list,
 * so no good is shown twice and the page isn't thirty tiles long.
 */
export function ModGoods({
  goods,
  readings,
  onPin,
}: {
  /** Goods that are neither pinned nor followed by a tracker. */
  goods: Good[];
  readings: Map<string, Reading>;
  onPin: (metric: string, pinned: boolean) => Promise<string | undefined>;
}) {
  const [busy, setBusy] = useState<string>();

  async function pin(good: Good) {
    setBusy(good.prefix);
    const error = await onPin(good.prefix, true);
    setBusy(undefined);
    if (error) toast.error(`Couldn't pin ${good.label}: ${error}`);
  }

  return (
    <section className="mt-4 rounded-2xl border bg-paper p-5 first:mt-0 sm:p-6" aria-labelledby="mod-goods">
      <h3 id="mod-goods" className="text-base font-semibold">
        Storage
      </h3>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
        How full storage is for each good, as the companion mod reports it. Pin a good to give it a tile with a chart.
      </p>
      <ul className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2 2xl:grid-cols-3">
        {goods.map((good) => (
          <li key={good.prefix} className="flex items-center gap-2.5 py-1">
            <GoodIcon good={good.prefix} className="size-6 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{good.label}</span>
            <span className="font-medium tabular-nums">{readings.get(good.prefix)!.value}%</span>
            <Button variant="ghost" size="sm" disabled={busy === good.prefix} onClick={() => pin(good)} className="text-ink-soft">
              <Pin />
              <span className="sr-only">Pin {good.label}</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
