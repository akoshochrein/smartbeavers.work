import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { formatDay, formatTime } from "@/lib/time";
import { HISTORY_DAYS } from "@/lib/useColonyFeed";
import { describeValue, formatValue, type HistoryPoint } from "@/shared/ladders";

const HEIGHT = 150;
const PAD = { top: 10, right: 10, bottom: 22, left: 30 };

type Segment = { t0: number; t1: number; point: HistoryPoint };

/**
 * A tracker's value over time. Each point is a signal, where the value is known; the line
 * between two signals is the straight path from one to the next, then flat from the last to now.
 */
export function ValueChart({ points, now, yTop, unit, suffix = "" }: { points: HistoryPoint[]; now: number; yTop: number; unit: string; suffix?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState<Segment>();

  if (points.length === 0) return null;

  const t0 = points[0].t;
  const t1 = Math.max(now, t0 + 60_000);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * plotW;
  const y = (v: number) => PAD.top + plotH - (Math.min(v, yTop) / yTop) * plotH;

  const segments: Segment[] = points.map((point, i) => ({ t0: point.t, t1: points[i + 1]?.t ?? t1, point }));

  const last = segments[segments.length - 1];
  const lastValue = last.point.value;
  const line = segments.map((s, i) => `${i ? "L" : "M"}${x(s.t0)},${y(s.point.value.value)}`).join("") + `H${x(t1)}`;
  const ticks = niceTicks(yTop);

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - rect.left - PAD.left) / plotW) * (t1 - t0);
    setHover(segments.find((s) => t >= s.t0 && t < s.t1) ?? (t >= t1 ? last : undefined));
  }

  const hoverX = hover ? x(Math.max(hover.t0, t0)) : 0;

  return (
    <div ref={wrapRef} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Last ${HISTORY_DAYS} days. Now ${formatValue(lastValue, suffix)} ${unit}.`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(undefined)}
          className="block touch-none"
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-ink-soft text-[10px] tabular-nums">
                {v.toLocaleString()}
              </text>
            </g>
          ))}

          <path d={line} fill="none" className="stroke-cobalt" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          <circle cx={x(t1)} cy={y(lastValue.value)} r={4} className="fill-cobalt stroke-paper" strokeWidth={2} />

          <text x={PAD.left} y={HEIGHT - 5} className="fill-ink-soft text-[10px]">{formatDay(t0)}</text>
          <text x={width - PAD.right} y={HEIGHT - 5} textAnchor="end" className="fill-ink-soft text-[10px]">now</text>

          {hover && <line x1={hoverX} x2={hoverX} y1={PAD.top} y2={PAD.top + plotH} className="stroke-ink-soft/60" strokeWidth={1} />}
        </svg>
      )}
      {hover && (
        <div
          className="pointer-events-none absolute -top-2 z-10 rounded-md bg-pine px-2.5 py-1.5 text-xs text-mist shadow-lg"
          style={{ left: Math.min(hoverX + 10, Math.max(0, width - 150)) }}
        >
          <div className="text-sage">{formatTime(hover.t0)}</div>
          <div className="font-bold tabular-nums">
            {formatValue(hover.point.value, suffix)} {unit}
          </div>
          <div className="text-sage">{describeValue(hover.point.value, suffix)}</div>
        </div>
      )}
    </div>
  );
}

function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** ~4 clean ticks from 0 to max. */
function niceTicks(max: number): number[] {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Math.round(v));
  return ticks;
}
