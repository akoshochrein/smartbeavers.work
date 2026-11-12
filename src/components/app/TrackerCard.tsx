import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { StatusDot } from "@/components/app/StatusDot";
import { ValueChart } from "@/components/ValueChart";
import { SignalMeter } from "@/components/SignalMeter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART_BUCKET_SECONDS, useAdapterHistory } from "@/lib/history";
import type { Ladder } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";
import { HISTORY_DAYS, type ColonyFeed } from "@/lib/useColonyFeed";
import { describeValue, discoverSteps, formatValue, ladderHistory, latestValue, metricFor, valueSuffix } from "@/shared/ladders";
import { GoodIcon } from "@/components/app/GoodIcon";

const LIVE_MS = 5 * 60_000;

export function TrackerCard({ ladder, feed }: { ladder: Ladder; feed: ColonyFeed }) {
  const metric = metricFor(ladder.metric);
  const suffix = valueSuffix(metric);
  const now = useNow(30_000);

  const steps = useMemo(() => discoverSteps(ladder, feed.states.values()), [ladder, feed.states]);
  const value = latestValue(steps);
  const names = useMemo(() => steps.map((s) => s.name), [steps]);
  const events = useAdapterHistory(ladder.colony_id, names, CHART_BUCKET_SECONDS, feed.live, names.length > 0);
  const history = useMemo(() => (events ? ladderHistory(ladder, events) : []), [ladder, events]);

  const live = value.kind !== "waiting" && now - value.at < LIVE_MS;
  const peak = Math.max(1, ...history.map((p) => p.value.value), ...steps.map((s) => s.bound));
  const yTop = metric.kind === "resource" ? 100 : Math.ceil(peak * 1.15);

  return (
    <article className="rounded-2xl border bg-paper p-5 sm:p-6">
      <header className="flex items-center gap-3">
        {metric.kind === "resource" && <GoodIcon good={metric.prefix} className="size-7" />}
        <h2 className="text-xl font-semibold">{metric.label}</h2>
        <Button asChild variant="ghost" size="sm" className="ml-auto text-cobalt-deep hover:text-cobalt-deep">
          <Link to="/colonies/$id/trackers/$ladderId" params={{ id: ladder.colony_id, ladderId: ladder.id }}>Setup guide</Link>
        </Button>
      </header>

      <div className="mt-4 min-h-[6.5rem]">
        {feed.loading ? (
          <div className="space-y-3 pt-1">
            <Skeleton className="h-14 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        ) : value.kind === "waiting" ? (
          <div>
            <div className="flex items-center gap-2.5 text-sm text-ink-soft">
              <StatusDot state={undefined} live className="size-2" /> Listening
            </div>
            <p className="mt-2 font-display text-xl leading-tight font-semibold">Waiting for the first counter</p>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-soft">
              Name an adapter <span className="font-mono text-[13px]">{metric.prefix}</span> plus its counter's number, such as{" "}
              <span className="font-mono text-[13px]">{metric.prefix}{metric.kind === "resource" ? 50 : 30}</span>. It shows up here the next time it switches on or off.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <div className="relative h-12 min-w-0 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={formatValue(value, suffix)}
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -40, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 24 }}
                    className="font-display text-5xl leading-none font-bold tracking-tight whitespace-nowrap tabular-nums"
                  >
                    {formatValue(value, suffix)}
                  </motion.div>
                </AnimatePresence>
              </div>
              <span className="text-lg text-ink-soft">{metric.unit}</span>
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
              <StatusDot state live={live} className="size-2" />
              {describeValue(value, suffix)} {timeAgo(value.at, now)}
            </p>
          </>
        )}
      </div>

      {steps.length > 0 && <SignalMeter steps={steps} className="mt-5" />}

      {history.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <div className="mb-2 text-sm text-ink-soft">Last {HISTORY_DAYS} days</div>
          <ValueChart points={history} now={now} yTop={yTop} unit={metric.unit} suffix={suffix} />
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
