import { Copy } from "lucide-react";
import { useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { copyText, CopyField } from "@/components/app/CopyField";
import { StatusDot } from "@/components/app/StatusDot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase, type Ladder } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";
import { useColony, useLadders } from "@/lib/useColony";
import { useColonyFeed } from "@/lib/useColonyFeed";
import { comparisonSymbol, discoverSteps, metricFor, type Comparison } from "@/shared/ladders";
import { webhookUrl } from "@/shared/webhook";
import { BackLink } from "./TrackerNew";

export function TrackerGuide() {
  const { id, ladderId } = useParams<{ id: string; ladderId: string }>();
  const [colony] = useColony(id);
  const ladders = useLadders(id);

  if (colony === undefined || ladders === undefined) return <Skeleton className="h-96 w-full rounded-2xl" />;
  const ladder = ladders.find((l) => l.id === ladderId);
  if (!colony || !ladder) return <p className="text-ink-soft">This tracker doesn't exist any more.</p>;

  return <Guide colonyId={colony.id} colonyName={colony.name} token={colony.webhook_token} ladder={ladder} />;
}

function Guide({ colonyId, colonyName, token, ladder }: { colonyId: string; colonyName: string; token: string; ladder: Ladder }) {
  const navigate = useNavigate();
  const feed = useColonyFeed(colonyId);
  const metric = metricFor(ladder.metric);
  const symbol = comparisonSymbol(ladder.comparison as Comparison);
  const steps = useMemo(() => discoverSteps(ladder, feed.states.values()), [ladder, feed.states]);
  const origin = window.location.origin;

  // Counters that start reporting while this page is open get a highlight.
  const reportedAtLoad = useRef<Set<string> | null>(null);
  if (reportedAtLoad.current === null && !feed.loading) {
    reportedAtLoad.current = new Set(steps.map((s) => s.name));
  }

  async function remove() {
    const { error } = await supabase.from("ladders").delete().eq("id", ladder.id);
    if (error) return toast.error(`Couldn't delete the tracker: ${error.message}`);
    toast.success(`${metric.label} tracker deleted`);
    navigate(`/colonies/${colonyId}`);
  }

  return (
    <div>
      <BackLink colonyId={colonyId} name={colonyName} />
      <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Set up your {metric.label.toLowerCase()} tracker</h1>

      <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-soft">
        Build a counter at any number you want to mark and name its adapter{" "}
        <span className="font-mono text-base">{metric.prefix}</span> plus that number. Two or three around your current{" "}
        {metric.label.toLowerCase()} is enough to start.
      </p>

      <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-12">
          <section className="space-y-5">
            <h2 className="text-2xl font-bold tracking-tight">Links for every adapter</h2>
            <CopyField label="Call when switched on" what="On link" value={webhookUrl(origin, token, "on")} />
            <CopyField label="Call when switched off" what="Off link" value={webhookUrl(origin, token, "off")} />
          </section>

          <section>
            <h2 className="text-2xl font-bold tracking-tight">For each number you want to mark</h2>
            <ol className="mt-5 space-y-5">
              {[
                <>
                  Build a <strong>Population Counter</strong>. Pick <strong>{metric.counterSetting}</strong> from its list,
                  pick <strong className="font-mono">{symbol}</strong>, and enter your number. <strong>District mode</strong> and{" "}
                  <strong>Global mode</strong> both work, as long as every counter of this tracker uses the same one.
                </>,
                <>
                  Build an <strong>HTTP Adapter</strong>. Click the pencil next to its name and rename it to{" "}
                  <strong className="font-mono">{metric.prefix}</strong> plus the counter's number: a counter at 30 gets{" "}
                  <strong className="font-mono">{metric.prefix}30</strong>. Capital letters matter.
                </>,
                <>
                  On the adapter, press <strong>Automate</strong> and choose that counter.
                </>,
                <>
                  Tick <strong>Call when switched on</strong> and <strong>Call when switched off</strong>, and paste the
                  two links. GET and POST both work.
                </>,
                <>
                  To see it report straight away, set the counter's number to <span className="font-mono">0</span>, then{" "}
                  <span className="font-mono">9999</span>, then back. It appears in the list here.
                </>,
              ].map((body, i) => (
                <li key={i} className="flex gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pine font-display text-base font-bold text-mist">
                    {i + 1}
                  </span>
                  <p className="pt-1 leading-relaxed text-ink-soft [&_strong]:font-bold [&_strong]:text-ink">{body}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section>
          <h2 className="text-2xl font-bold tracking-tight">Counters reporting</h2>
          <div className="mt-4 overflow-hidden rounded-xl border bg-paper">
            <Table>
              <TableHeader>
                <TableRow className="bg-mist-2/60 hover:bg-mist-2/60">
                  <TableHead className="pl-4">Counter</TableHead>
                  <TableHead>Adapter name</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!feed.loading && steps.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="px-4 py-8 text-center text-ink-soft">
                      <span className="inline-flex items-center gap-2">
                        <StatusDot state={undefined} live /> Listening. Counters appear here as they report.
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {steps.map((s) => {
                  const fresh = reportedAtLoad.current !== null && !reportedAtLoad.current.has(s.name);
                  return (
                    <TableRow key={s.name} className={fresh ? "animate-in bg-resin-soft/60 duration-700 fade-in" : undefined}>
                      <TableCell className="pl-4 whitespace-nowrap tabular-nums">
                        <span className="font-mono">{symbol} {s.threshold}</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-mono text-[13px]"
                          onClick={() => copyText(s.name, s.name)}
                          aria-label={`Copy adapter name ${s.name}`}
                        >
                          {s.name}
                          <Copy className="text-ink-soft" />
                        </Button>
                      </TableCell>
                      <TableCell className="pr-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <StatusDot state={s.state} live={fresh} />
                          {s.state ? "On" : "Off"}
                          <span className="text-ink-soft">{timeAgo(s.at)}</span>
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t pt-8 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold">Delete this tracker</h3>
              <p className="mt-1 text-sm text-ink-soft">Signal history stays, so you can add the tracker back later.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="sm:ml-auto">
                  Delete tracker
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display text-2xl font-bold tracking-tight">Delete the {metric.label.toLowerCase()} tracker?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The tracker disappears from your dashboard. Signals from these adapters are still recorded.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={remove} className="bg-danger text-white hover:bg-danger/90">
                    Delete tracker
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>
      </div>
    </div>
  );
}
