import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { formatReading, type HistoryPoint } from "../shared/ladders";
import { formatTime } from "../lib/time";

const HEIGHT = 160;
const PAD = { top: 8, right: 12, bottom: 22, left: 36 };

type Segment = { t0: number; t1: number; point: HistoryPoint };

/**
 * Step chart of a ladder's reading over time. The wash shows the range the value is known to
 * be in; the 2px line is its lower bound ("at least N"). Gaps = conflicting signals.
 */
export function RangeChart({ points, now, yTop, unit }: { points: HistoryPoint[]; now: number; yTop: number; unit: string }) {
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

  const segments: Segment[] = points.map((point, i) => ({
    t0: point.t,
    t1: points[i + 1]?.t ?? t1,
    point,
  }));

  let line = "";
  let penDown = false;
  for (const s of segments) {
    const r = s.point.reading;
    if (r.kind !== "range") {
      penDown = false;
      continue;
    }
    line += `${penDown ? "L" : "M"}${x(s.t0)},${y(r.min)}H${x(s.t1)}`;
    penDown = true;
  }
  const last = segments[segments.length - 1];
  const lastReading = last.point.reading;
  const ticks = niceTicks(yTop);

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - rect.left - PAD.left) / plotW) * (t1 - t0);
    setHover(segments.find((s) => t >= s.t0 && t < s.t1) ?? (t >= t1 ? last : undefined));
  }

  return (
    <div ref={wrapRef} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`History: now ${formatReading(lastReading)} ${unit}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(undefined)}
          className="block touch-none"
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} className="stroke-bark-100" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-bark-500 text-[10px] tabular-nums">
                {v.toLocaleString()}
              </text>
            </g>
          ))}

          {segments.map((s, i) => {
            const r = s.point.reading;
            if (r.kind !== "range") return null;
            const top = y(r.max === null ? yTop : r.max);
            return (
              <rect key={i} x={x(s.t0)} width={Math.max(0, x(s.t1) - x(s.t0))} y={top} height={Math.max(1, y(r.min) - top)} className="fill-chart" fillOpacity={0.12} />
            );
          })}

          <path d={line} fill="none" className="stroke-chart" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {lastReading.kind === "range" && (
            <circle cx={x(t1)} cy={y(lastReading.min)} r={4} className="fill-chart stroke-white" strokeWidth={2} />
          )}

          <text x={PAD.left} y={HEIGHT - 6} className="fill-bark-500 text-[10px]">{formatTime(t0)}</text>
          <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-bark-500 text-[10px]">now</text>

          {hover && (
            <line x1={x(Math.max(hover.t0, t0))} x2={x(Math.max(hover.t0, t0))} y1={PAD.top} y2={PAD.top + plotH} className="stroke-bark-300" strokeWidth={1} />
          )}
        </svg>
      )}
      {hover && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-md border border-bark-200 bg-white px-2 py-1 text-xs shadow-sm"
          style={{ left: Math.min(x(hover.t0) + 8, Math.max(0, width - 150)) }}
        >
          <div className="text-bark-500">{formatTime(hover.t0)}</div>
          <div className="font-medium tabular-nums text-bark-900">
            {formatReading(hover.point.reading)} {hover.point.reading.kind === "range" ? unit : ""}
          </div>
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
