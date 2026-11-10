import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { StepState } from "@/shared/ladders";

export type MeterStep = { bound: number; state: StepState };

// Literal colors (motion can't interpolate CSS variables). Keep in sync with index.css.
const COBALT = "#1c86b0";
const FLASH_ON = ["#f2b33d", COBALT]; // stable reference: only re-runs when a segment turns on
const OFF = { light: "rgba(27, 36, 34, 0.1)", dark: "rgba(238, 243, 241, 0.15)" };
const NONE = "rgba(0, 0, 0, 0)";

function Segment({ state, tone, reduce, className }: { state: StepState; tone: "light" | "dark"; reduce: boolean; className: string }) {
  // Flash only on a real off/unknown -> on change, never on unrelated re-renders.
  const prev = useRef(state);
  const justOn = state === true && prev.current !== true && !reduce;
  useEffect(() => {
    prev.current = state;
  }, [state]);
  const target = state === true ? (justOn ? FLASH_ON : COBALT) : state === false ? OFF[tone] : NONE;
  return (
    <motion.div
      initial={false}
      animate={{ backgroundColor: target }}
      transition={{ duration: justOn ? 0.9 : 0.4, ease: "easeOut" }}
      className={cn(
        "rounded-[3px]",
        className,
        state === undefined && (tone === "dark" ? "border border-dashed border-sage/50" : "border border-dashed border-ink-soft/45"),
      )}
    />
  );
}

/**
 * One segment per counter, lowest on the left. Lit = that counter is on, dim = off,
 * dashed = it hasn't reported yet. Segments flash amber as they switch on.
 */
export function SignalMeter({
  steps,
  size = "md",
  tone = "light",
  labels = true,
  className,
}: {
  steps: MeterStep[];
  size?: "sm" | "md" | "lg";
  tone?: "light" | "dark";
  labels?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const sorted = [...steps].sort((a, b) => a.bound - b.bound);
  const stride = Math.max(1, Math.ceil(sorted.length / 12));
  const height = size === "lg" ? "h-5" : size === "sm" ? "h-2" : "h-3.5";

  return (
    <div className={cn("w-full", className)}>
      <ol className="flex gap-1" aria-label="Counters, lowest first">
        {sorted.map((s, i) => (
          <li key={s.bound} className="min-w-0 flex-1">
            <Segment state={s.state} tone={tone} reduce={!!reduce} className={height} />
            <span className="sr-only">
              {s.bound}: {s.state === undefined ? "waiting" : s.state ? "on" : "off"}
            </span>
            {labels && (
              <div
                aria-hidden
                className={cn(
                  "mt-1.5 truncate text-center text-[11px] tabular-nums",
                  tone === "dark" ? "text-sage" : "text-ink-soft",
                  i % stride !== 0 && "invisible",
                )}
              >
                {s.bound}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
