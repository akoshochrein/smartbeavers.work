import { ChevronRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { NewColonyDialog } from "@/components/app/NewColonyDialog";
import { StatusDot } from "@/components/app/StatusDot";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useColonies } from "@/lib/colonies";
import { supabase } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";

type Summary = { id: string; trackers: number; lastSignal?: string };

const RECENT_MS = 10 * 60_000;

export function Dashboard() {
  const { colonies } = useColonies();
  const [summaries, setSummaries] = useState<Map<string, Summary>>(new Map());

  useEffect(() => {
    if (!colonies?.length) return;
    supabase
      .from("colonies")
      .select("id, ladders(count), adapter_states(updated_at)")
      .then(({ data }) => {
        const map = new Map<string, Summary>();
        for (const row of data ?? []) {
          const last = row.adapter_states.map((s) => s.updated_at).sort().at(-1);
          map.set(row.id, { id: row.id, trackers: row.ladders[0]?.count ?? 0, lastSignal: last });
        }
        setSummaries(map);
      });
  }, [colonies]);

  if (colonies === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (colonies.length === 0) return <EmptyState />;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="text-4xl font-extrabold sm:text-5xl">Your colonies</h1>
        <NewColonyDialog>
          <Button className="ml-auto">
            <Plus /> New colony
          </Button>
        </NewColonyDialog>
      </div>

      <ul className="mt-10 divide-y divide-border border-y border-border">
        {colonies.map((c) => {
          const s = summaries.get(c.id);
          const recent = s?.lastSignal && Date.now() - Date.parse(s.lastSignal) < RECENT_MS;
          return (
            <li key={c.id}>
              <Link
                to={`/colonies/${c.id}`}
                className="group flex items-center gap-6 py-6 outline-offset-4 transition-colors hover:bg-paper sm:px-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-3xl leading-none font-extrabold group-hover:text-cobalt-deep">{c.name}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-soft">
                    <span>{s ? `${s.trackers} ${s.trackers === 1 ? "tracker" : "trackers"}` : " "}</span>
                    {s && (
                      <span className="inline-flex items-center gap-2">
                        <StatusDot state={s.lastSignal ? true : undefined} live={!!recent} />
                        {s.lastSignal ? `Last signal ${timeAgo(s.lastSignal)}` : "No signals yet"}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="size-6 shrink-0 text-ink-soft transition-transform group-hover:translate-x-1" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-6">
      <div className="max-w-md">
        <h1 className="text-4xl leading-none font-extrabold sm:text-5xl">Start with your first colony</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          A colony matches one of your saves. Create one to get the links your HTTP Adapters will call.
        </p>
        <NewColonyDialog>
          <Button size="lg" className="mt-6 h-11 px-5 text-base">
            <Plus /> Create a colony
          </Button>
        </NewColonyDialog>
      </div>
    </div>
  );
}
