import { cn } from "@/lib/utils";

/** Resin = a signal arrived recently (pulses), cobalt = on, grey = off, hollow = nothing yet. */
export function StatusDot({ state, live, className }: { state: boolean | undefined; live?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        state === undefined && "border border-dashed border-ink-soft",
        state === true && "bg-cobalt",
        state === false && "bg-ink-soft/35",
        live && "bg-resin animate-signal",
        className,
      )}
    />
  );
}
