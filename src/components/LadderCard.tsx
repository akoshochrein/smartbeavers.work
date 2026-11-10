import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import type { ColonyFeed } from "../lib/useColonyFeed";
import type { Ladder } from "../lib/supabase";
import { timeAgo } from "../lib/time";
import { formatReading, ladderHistory, ladderSteps, metricFor, readSteps, type Step } from "../shared/ladders";
import { RangeChart } from "./RangeChart";

export function LadderCard({ ladder, feed }: { ladder: Ladder; feed: ColonyFeed }) {
  const metric = metricFor(ladder.metric);
  const now = useNow(30_000);

  const steps = useMemo(
    () => ladderSteps(ladder, (name) => feed.states.get(name)?.state),
    [ladder, feed.states],
  );
  const reading = readSteps(steps);
  const history = useMemo(() => ladderHistory(ladder, feed.events), [ladder, feed.events]);

  const lastUpdate = steps
    .map((s) => feed.states.get(s.name)?.updated_at)
    .filter((t): t is string => !!t)
    .sort()
    .at(-1);

  const bounds = steps.map((s) => s.bound);
  const topBound = bounds[bounds.length - 1];
  const gap = bounds.length > 1 ? topBound - bounds[bounds.length - 2] : Math.max(1, Math.round(topBound / 4));
  const yTop = topBound + gap;

  return (
    <section className="rounded-xl border border-bark-200 bg-white/70 p-5 shadow-sm">
      <div className="flex items-baseline gap-3">
        <h2 className="font-semibold">{metric.label}</h2>
        <Link to={`trackers/${ladder.id}`} className="ml-auto text-xs text-river-700 hover:underline">
          Setup guide
        </Link>
      </div>

      {feed.loading ? (
        <p className="py-6 text-sm text-bark-500">Loading…</p>
      ) : reading.kind === "waiting" ? (
        <div className="flex items-center gap-3 py-6">
          <span className="size-5 animate-spin rounded-full border-2 border-bark-200 border-t-chart" aria-hidden />
          <div>
            <p className="font-medium">Waiting for data</p>
            <p className="text-sm text-bark-500">
              Each step reports the next time its counter flips. The setup guide has a trick to make them report now.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`font-semibold tabular-nums ${reading.kind === "conflict" ? "text-2xl text-ember-500" : "text-5xl"}`}>
              {formatReading(reading)}
            </span>
            {reading.kind === "range" && <span className="text-bark-500">{metric.unit}</span>}
          </div>
          <p className="mt-1 text-xs text-bark-500">
            {reading.kind === "conflict"
              ? "A higher step is on while a lower one is off. Check the counters' thresholds and adapter names."
              : lastUpdate && `Last change ${timeAgo(lastUpdate, now)}`}
          </p>
        </>
      )}

      <StepStrip steps={steps} />

      {history.length > 0 && (
        <div className="mt-4">
          <RangeChart points={history} now={now} yTop={yTop} unit={metric.unit} />
        </div>
      )}
    </section>
  );
}

function StepStrip({ steps }: { steps: Step[] }) {
  const waiting = steps.filter((s) => s.state === undefined).length;
  return (
    <div className="mt-4">
      <ol className="flex gap-0.5">
        {steps.map((s) => (
          <li key={s.name} className="min-w-0 flex-1" title={`${s.name}: ${s.state === undefined ? "waiting for data" : s.state ? "on" : "off"}`}>
            <div
              className={`h-2 rounded-sm ${
                s.state === undefined ? "border border-dashed border-bark-300" : s.state ? "bg-chart" : "bg-bark-100"
              }`}
            />
            <div className="mt-1 truncate text-center text-[10px] tabular-nums text-bark-500">{s.bound}</div>
          </li>
        ))}
      </ol>
      <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-bark-500">
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-chart align-middle" />reached</span>
        <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-bark-100 align-middle" />not reached</span>
        {waiting > 0 && (
          <span><span className="mr-1 inline-block h-2 w-3 rounded-sm border border-dashed border-bark-300 align-middle" />{waiting} waiting</span>
        )}
      </p>
    </div>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
