import { useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from "react";
import { formatDay, formatTime } from "@/lib/time";
import { describeValue, formatValue, type HistoryPoint } from "@/shared/ladders";

const HEIGHT = 150;
const PAD = { top: 10, right: 10, bottom: 22, left: 36 };
/** Above this many game days, per-day marks on the axis would be a smear. */
const MAX_DAY_MARKS = 60;

/** Where a moment sits on the horizontal axis, and how to name it. */
type Axis = { pos: (t: number) => number; end: number; startLabel: string; endLabel: string; label: (t: number) => string; marks: number[] };

/** Real time: a minute is as wide as any other minute. */
function timeAxis(t0: number, now: number): Axis {
  return { pos: (t) => Math.max(0, t - t0), end: Math.max(now, t0 + 60_000) - t0, startLabel: formatDay(t0), endLabel: "now", label: (t) => formatTime(t), marks: [] };
}

/**
 * Game time: every game day is equally wide, however long it took in real time, so a paused
 * or closed game takes no room. `starts` are the moments each day began, oldest first.
 */
function gameDayAxis(starts: number[], now: number): Axis {
  const n = starts.length;
  const gaps = starts.slice(1).map((t, i) => t - starts[i]).sort((a, b) => a - b);
  const typical = gaps.length ? gaps[gaps.length >> 1] : Math.max(60_000, now - starts[0]);
  const pos = (t: number) => {
    if (t <= starts[0]) return 0;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    const length = lo < n - 1 ? starts[lo + 1] - starts[lo] : typical;
    return lo + Math.min(1, (t - starts[lo]) / length);
  };
  const daysAgo = (t: number) => n - 1 - Math.min(n - 1, Math.floor(pos(t)));
  const ago = (d: number) => (d === 0 ? "Today" : d === 1 ? "1 game day ago" : `${d.toLocaleString()} game days ago`);
  return {
    pos,
    end: Math.max(pos(now), 0.05),
    startLabel: n === 1 ? "start of today" : ago(n - 1).toLowerCase(),
    endLabel: "today",
    label: (t) => ago(daysAgo(t)),
    marks: n <= MAX_DAY_MARKS ? starts.map((_, i) => i).slice(1) : [],
  };
}

/** A round step giving about `count` ticks across `span`. */
function niceStep(span: number, count: number) {
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
}

/**
 * A tracker's value over time. Each point is a signal, where the value is known; the line
 * between two signals is the straight path from one to the next, then flat from the last to now.
 *
 * `domain` fixes the vertical range (0 to 100 for percentages). Without it the range hugs the
 * data, so a population moving between 230 and 250 isn't a flat line far above zero.
 * `dayStarts` (from the game clock) switches the horizontal axis from real time to game days.
 */
export function ValueChart({
  points: allPoints,
  now,
  unit,
  suffix = "",
  domain,
  dayStarts,
}: {
  points: HistoryPoint[];
  now: number;
  unit: string;
  suffix?: string;
  domain?: [number, number];
  dayStarts?: number[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState<number>();

  const gameDays = !!dayStarts?.length;
  // In game days the chart starts where the day window starts: keep the last earlier point as the opening value.
  const points = useMemo(() => {
    if (!dayStarts?.length) return allPoints;
    const first = allPoints.findLastIndex((p) => p.t <= dayStarts[0]);
    return first > 0 ? allPoints.slice(first) : allPoints;
  }, [allPoints, dayStarts]);
  const axis = useMemo(
    () => (points.length === 0 ? undefined : gameDays ? gameDayAxis(dayStarts!, now) : timeAxis(points[0].t, now)),
    [points, gameDays, dayStarts, now],
  );

  if (!axis) return null;

  const values = points.map((p) => p.value.value);
  let [yMin, yMax] = domain ?? [0, 0];
  let step = niceStep(yMax - yMin, 4);
  if (!domain) {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    step = Math.max(1, niceStep(Math.max(hi - lo, 4), 3));
    yMin = Math.max(0, Math.floor((lo - step / 2) / step) * step);
    yMax = Math.ceil((hi + step / 2) / step) * step;
  }
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(v);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + (Math.min(axis.pos(t), axis.end) / axis.end) * plotW;
  const xAt = (pos: number) => PAD.left + (pos / axis.end) * plotW;
  const y = (v: number) => PAD.top + plotH - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * plotH;

  const last = points[points.length - 1];
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p.value.value)}`).join("") + `H${PAD.left + plotW}`;

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let nearest = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.t) - px) < Math.abs(x(points[nearest].t) - px)) nearest = i;
    });
    setHover(nearest);
  }

  const hovered = hover !== undefined ? points[Math.min(hover, points.length - 1)] : undefined;
  const hoverX = hovered ? x(hovered.t) : 0;
  const flip = hoverX > width / 2;

  return (
    <div ref={wrapRef} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${unit ? `${unit}, ` : ""}${axis.startLabel} to ${axis.endLabel}. Now ${formatValue(last.value, suffix)}.`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(undefined)}
          className="block touch-none"
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-ink-soft text-[10px] tabular-nums">
                {v.toLocaleString()}
                {suffix}
              </text>
            </g>
          ))}

          {axis.marks.map((pos) => (
            <line key={pos} x1={xAt(pos)} x2={xAt(pos)} y1={PAD.top + plotH} y2={PAD.top + plotH + 4} className="stroke-ink-soft/50" strokeWidth={1} />
          ))}

          {hovered && <line x1={hoverX} x2={hoverX} y1={PAD.top} y2={PAD.top + plotH} className="stroke-ink-soft/60" strokeWidth={1} />}

          <path d={line} fill="none" className="stroke-cobalt" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          <circle cx={PAD.left + plotW} cy={y(last.value.value)} r={4} className="fill-cobalt stroke-paper" strokeWidth={2} />
          {hovered && <circle cx={hoverX} cy={y(hovered.value.value)} r={4} className="fill-paper stroke-cobalt" strokeWidth={2} />}

          <text x={PAD.left} y={HEIGHT - 3} className="fill-ink-soft text-[10px]">{axis.startLabel}</text>
          <text x={width - PAD.right} y={HEIGHT - 3} textAnchor="end" className="fill-ink-soft text-[10px]">{axis.endLabel}</text>
        </svg>
      )}
      {hovered && (
        <div
          className="pointer-events-none absolute -top-9 z-10 rounded-md bg-pine px-2.5 py-1.5 text-xs whitespace-nowrap text-mist shadow-lg"
          style={flip ? { right: width - hoverX + 10 } : { left: hoverX + 10 }}
        >
          <div className="font-bold tabular-nums">
            {formatValue(hovered.value, suffix)} {unit}
          </div>
          <div className="text-sage">
            {hovered.value.kind !== "reached" && `${describeValue(hovered.value, suffix)} · `}
            {axis.label(hovered.t)}
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
