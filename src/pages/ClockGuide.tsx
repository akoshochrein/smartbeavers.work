import { keys, useInvalidate } from "@/lib/queries";
import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { copyText, CopyField } from "@/components/app/CopyField";
import { SetDateDialog } from "@/components/app/SetDateDialog";
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
import { useGameClock, useGameDate } from "@/lib/clock";
import { supabase } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";
import { useColony } from "@/lib/useColony";
import { useColonyFeed } from "@/lib/useColonyFeed";
import { useDateVersion } from "@/components/app/GameClockCard";
import { CLOCK_ADAPTER, formatGameDate } from "@/shared/clock";
import { webhookUrl } from "@/shared/webhook";
import { BackLink } from "./TrackerNew";

export function ClockGuide() {
  const { id } = useParams({ from: "/_app/colonies/$id/trackers/clock" });
  const [colony] = useColony(id);
  const [clock] = useGameClock(id);
  if (colony === undefined || clock === undefined) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (!colony || !clock) return <p className="text-ink-soft">This colony doesn't have a game clock yet.</p>;
  return <Guide colonyId={colony.id} colonyName={colony.name} token={colony.webhook_token} />;
}

function Guide({ colonyId, colonyName, token }: { colonyId: string; colonyName: string; token: string }) {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const feed = useColonyFeed(colonyId);
  const [setCount, setSetCount] = useState(0);
  const version = useDateVersion(feed);
  const date = useGameDate(colonyId, true, `${version}-${setCount}`);
  const lastDay = feed.states.get(CLOCK_ADAPTER);

  async function remove() {
    const { error } = await supabase.from("game_clocks").delete().eq("colony_id", colonyId);
    if (error) return toast.error(`Couldn't remove the game clock: ${error.message}`);
    await invalidate(keys.gameClock(colonyId), keys.gameDate(colonyId));
    toast.success("Game clock removed");
    navigate({ to: "/colonies/$id", params: { id: colonyId } });
  }

  return (
    <div>
      <BackLink colonyId={colonyId} name={colonyName} />
      <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Set up the game clock</h1>

      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border bg-paper p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-pine text-mist" aria-hidden>
          <CalendarClock className="size-6" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-2xl font-bold tracking-tight">
            {date ? formatGameDate(date.cycle, date.day) : <Skeleton className="h-7 w-48" />}
          </div>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-ink-soft">
            {lastDay ? (
              <>
                <StatusDot state /> Last day signal {timeAgo(lastDay.updated_at)}
              </>
            ) : (
              <>
                <StatusDot state={undefined} live /> Waiting for the first day signal
              </>
            )}
          </p>
        </div>
        {date && (
          <SetDateDialog colonyId={colonyId} current={{ cycle: date.cycle, day: date.day }} onSet={() => setSetCount((n) => n + 1)}>
            <Button variant="outline">Set the date</Button>
          </SetDateDialog>
        )}
      </div>

      <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_1fr]">
        <section>
          <h2 className="text-2xl font-bold tracking-tight">In your colony</h2>
          <ol className="mt-5 space-y-5">
            {[
              <>
                Build a <strong>Chronometer</strong> and set it to switch on from <strong>00:00 to 00:25</strong>. That's its shortest
                setting, a quarter of an hour at the very start of each day.
              </>,
              <>
                Build an <strong>HTTP Adapter</strong>. Click the pencil next to its name and rename it to{" "}
                <button
                  type="button"
                  onClick={() => copyText(CLOCK_ADAPTER, CLOCK_ADAPTER)}
                  className="rounded bg-mist-2 px-1.5 font-mono text-[13px] text-ink hover:bg-border"
                  aria-label={`Copy adapter name ${CLOCK_ADAPTER}`}
                >
                  {CLOCK_ADAPTER}
                </button>
                .
              </>,
              <>
                On the adapter, press <strong>Automate</strong> and choose the Chronometer.
              </>,
              <>
                Tick only <strong>Call when switched on</strong> and paste the link. The clock doesn't need the "off" call.
              </>,
              <>
                Keep playing. The first signal arrives at the next midnight in the game, and the date above moves on.
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

        <div className="space-y-10">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">Link for the adapter</h2>
            <CopyField label="Call when switched on" what="On link" value={webhookUrl(window.location.origin, token, "on")} />
          </section>

          <section className="space-y-2 text-sm leading-relaxed text-ink-soft">
            <h2 className="text-2xl font-bold tracking-tight text-ink">How the date moves</h2>
            <p>Every day signal adds a day. When temperate weather starts, a new cycle begins and the day goes back to 1.</p>
            {date && !date.cycles_tracked && (
              <p className="rounded-lg bg-resin-soft/60 px-3 py-2 text-ink">
                That needs weather tracking, which this colony doesn't have yet.{" "}
                <Link to="/colonies/$id/trackers/new" params={{ id: colonyId }} search={{ kind: "weather" }} className="font-medium text-cobalt-deep underline-offset-4 hover:underline">
                  Set it up
                </Link>
              </p>
            )}
            <p>If the date ever drifts, for example after the game crashed, use Set the date to match the game again.</p>
          </section>

          <section className="flex flex-col gap-4 border-t pt-8 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold">Stop the game clock</h3>
              <p className="mt-1 text-sm text-ink-soft">The date goes away. Day signals and their history stay.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="sm:ml-auto">
                  Stop the clock
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display text-2xl font-bold tracking-tight">Stop the game clock?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The date disappears from this colony. You can start the clock again later and set the date.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={remove} className="bg-danger text-white hover:bg-danger/90">
                    Stop the clock
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        </div>
      </div>
    </div>
  );
}
