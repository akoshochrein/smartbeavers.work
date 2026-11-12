import { Power } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The game switches its API off whenever a save is loaded, and adapters send nothing until the
 * player starts it again. Button and warning labels are the game's own (enUS localisation).
 */
export function StartApiNote({ className }: { className?: string }) {
  return (
    <aside className={cn("flex gap-3 rounded-xl bg-resin-soft/60 px-4 py-3 text-sm leading-relaxed text-ink", className)}>
      <Power className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <strong className="font-bold">Start the API every time you load the game.</strong> Timberborn switches it off
        when a save is loaded, and its buildings show "API stopped". Select any HTTP Adapter or HTTP Lever, press{" "}
        <strong className="font-bold">Start API</strong>, and confirm with{" "}
        <strong className="font-bold">I understand the risk</strong>. Nothing is sent until you do.
      </p>
    </aside>
  );
}
