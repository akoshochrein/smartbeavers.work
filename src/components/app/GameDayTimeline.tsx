import { useState } from "react";
import { pluralDays } from "@/shared/clock";
import { cn } from "@/lib/utils";
import { weatherInfo, type Weather } from "@/shared/weather";
import { WEATHER_STYLE } from "./weather";

export type DaySegment = { weather: Weather | null; days: number; ongoing: boolean };

/** Weather over the last game days, each segment as wide as its number of game days. */
export function GameDayTimeline({ segments, totalDays }: { segments: DaySegment[]; totalDays: number }) {
  const [active, setActive] = useState<number>();
  const shown = segments.filter((s) => s.days > 0);
  if (shown.length === 0 || totalDays === 0) return null;
  const hovered = active !== undefined ? shown[active] : undefined;

  let offset = 0;
  return (
    <div>
      <div className="relative h-4" onPointerLeave={() => setActive(undefined)}>
        {shown.map((s, i) => {
          const left = (offset / totalDays) * 100;
          offset += s.days;
          return (
            <button
              key={i}
              type="button"
              aria-label={describe(s)}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(undefined)}
              className={cn(
                "absolute inset-y-0 rounded-[3px] border-r-2 border-paper outline-offset-2 transition-opacity",
                s.weather ? WEATHER_STYLE[s.weather].bar : "bg-mist-2",
                hovered && hovered !== s && "opacity-50",
              )}
              style={{ left: `${left}%`, width: `${(s.days / totalDays) * 100}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-soft">
        <span>{totalDays.toLocaleString()} game {totalDays === 1 ? "day" : "days"} ago</span>
        <span>today</span>
      </div>
      <p className="mt-1 min-h-5 text-xs text-ink" aria-live="polite">
        {hovered && describe(hovered)}
      </p>
    </div>
  );
}

function describe(s: DaySegment) {
  const label = s.weather ? weatherInfo(s.weather).label : "Unknown weather";
  return `${label}, ${pluralDays(s.days)}${s.ongoing ? " so far" : ""}`;
}
