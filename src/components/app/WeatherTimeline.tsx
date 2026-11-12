import { useState } from "react";
import { formatDay } from "@/lib/time";
import { HISTORY_DAYS } from "@/lib/useColonyFeed";
import { cn } from "@/lib/utils";
import { periodEnd, weatherInfo, type WeatherPeriod } from "@/shared/weather";
import { WEATHER_STYLE } from "./weather";

const WINDOW_MS = HISTORY_DAYS * 86_400_000;

/**
 * The history window as one strip, a segment per weather period. Hover or focus a segment for
 * details. Periods are summarised per time slot, so details are given in days, not exact times.
 */
export function WeatherTimeline({ periods, now }: { periods: WeatherPeriod[]; now: number }) {
  const [active, setActive] = useState<number>();
  const visible = periods.filter((p) => (p.end ?? now) > now - WINDOW_MS);
  if (visible.length === 0) return null;

  const t0 = Math.max(now - WINDOW_MS, visible[0].start);
  const span = Math.max(1, now - t0);
  const hovered = active !== undefined ? visible[active] : undefined;

  return (
    <div>
      <div className="relative h-4" onPointerLeave={() => setActive(undefined)}>
        {visible.map((p, i) => {
          const start = Math.max(p.start, t0);
          const end = periodEnd(p) ?? now;
          return (
            <button
              key={`${p.weather}-${p.start}`}
              type="button"
              aria-label={describe(p)}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(undefined)}
              className={cn(
                "absolute inset-y-0 rounded-[3px] border-r-2 border-paper outline-offset-2 transition-opacity",
                WEATHER_STYLE[p.weather].bar,
                hovered && hovered !== p && "opacity-50",
              )}
              style={{ left: `${((start - t0) / span) * 100}%`, width: `${Math.max(0.6, ((end - start) / span) * 100)}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-soft">
        <span>{formatDay(t0)}</span>
        <span>now</span>
      </div>
      <p className="mt-1 min-h-5 text-xs text-ink" aria-live="polite">
        {hovered && describe(hovered)}
      </p>
    </div>
  );
}

function describe(p: WeatherPeriod) {
  const label = weatherInfo(p.weather).label;
  const end = periodEnd(p);
  const from = formatDay(p.start);
  const to = end === null ? "now" : formatDay(end);
  return from === to ? `Mostly ${label.toLowerCase()} on ${from}` : `Mostly ${label.toLowerCase()}, ${from} to ${to}`;
}
