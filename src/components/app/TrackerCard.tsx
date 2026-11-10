import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { StatusDot } from "@/components/app/StatusDot";
import { RangeChart } from "@/components/RangeChart";
import { SignalMeter } from "@/components/SignalMeter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Ladder } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";
import type { ColonyFeed } from "@/lib/useColonyFeed";
import { formatReading, ladderHistory, ladderSteps, metricFor, readSteps } from "@/shared/ladders";

const LIVE_MS = 5 * 60_000;

export function TrackerCard({ ladder, feed }: { ladder: Ladder; feed: ColonyFeed }) {
  const metric = metricFor(ladder.metric);
  const now = useNow(30_000);

  const steps = useMemo(() => ladderSteps(ladder, (name) => feed.states.get(name)?.state), [ladder, feed.states]);
  const reading = readSteps(steps);
  const history = useMemo(() => ladderHistory(ladder, feed.events), [ladder, feed.events]);

  const lastUpdate = steps
    .map((s) => feed.states.get(s.name)?.updated_at)
    .filter((t): t is string => !!t)
    .sort()
    .at(-1);
  const live = !!lastUpdate && now - Date.parse(lastUpdate) < LIVE_MS;

  const bounds = steps.map((s) => s.bound);
  const topBound = bounds[bounds.length - 1];
  const gap = bounds.length > 1 ? topBound - bounds[bounds.length - 2] : Math.max(1, Math.round(topBound / 4));
  const yTop = topBound + gap;
  const waiting = steps.filter((s) => s.state === undefined).length;

  return (
    <article className="rounded-2xl border bg-paper p-5 sm:p-6">
      <header className="flex items-center gap-3">
        <h2 className="text-2xl leading-none font-bold">{metric.label}</h2>
        <Button asChild variant="ghost" size="sm" className="ml-auto text-cobalt-deep hover:text-cobalt-deep">
          <Link to={`trackers/${ladder.id}`}>Setup guide</Link>
        </Button>
      </header>

      <div className="mt-4 min-h-[6.5rem]">
        {feed.loading ? (
          <div className="space-y-3 pt-1">
            <Skeleton className="h-14 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        ) : reading.kind === "waiting" ? (
          <div>
            <div className="flex items-center gap-2.5 text-sm text-ink-soft">
              <StatusDot state={undefined} live className="size-2" /> Listening
            </div>
            <p className="mt-2 font-display text-2xl leading-tight font-bold">Waiting for the first signal</p>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-soft">
              Counters report the next time they switch on or off. The setup guide shows how to make them report now.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <div className="relative h-[3.75rem] min-w-0 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={formatReading(reading)}
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -40, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 24 }}
                    className={
                      reading.kind === "conflict"
                        ? "font-display text-3xl leading-[3.75rem] font-extrabold whitespace-nowrap text-danger"
                        : "font-display text-[3.75rem] leading-none font-black whitespace-nowrap tabular-nums"
                    }
                  >
                    {reading.kind === "conflict" ? "Mixed signals" : formatReading(reading)}
                  </motion.div>
                </AnimatePresence>
              </div>
              {reading.kind === "range" && <span className="text-lg text-ink-soft">{metric.unit}</span>}
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
              {reading.kind === "conflict" ? (
                "A higher counter is on while a lower one is off. Check their numbers and adapter names."
              ) : (
                <>
                  <StatusDot state live={live} className="size-2" />
                  {lastUpdate && `Changed ${timeAgo(lastUpdate, now)}`}
                </>
              )}
            </p>
          </>
        )}
      </div>

      <SignalMeter steps={steps} className="mt-5" />
      {waiting > 0 && reading.kind !== "waiting" && (
        <p className="mt-2 text-xs text-ink-soft">
          {waiting} of {steps.length} counters haven't reported yet, so the range is wider than it will be.
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <div className="mb-2 text-sm text-ink-soft">Last 7 days</div>
          <RangeChart points={history} now={now} yTop={yTop} unit={metric.unit} />
        </div>
      )}
    </article>
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
