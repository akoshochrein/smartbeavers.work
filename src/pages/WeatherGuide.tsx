import { Copy } from "lucide-react";
import { useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { copyText, CopyField } from "@/components/app/CopyField";
import { StatusDot } from "@/components/app/StatusDot";
import { WeatherBadge } from "@/components/app/weather";
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";
import { useColony, useWeatherTracker } from "@/lib/useColony";
import { useColonyFeed } from "@/lib/useColonyFeed";
import { WEATHERS } from "@/shared/weather";
import { webhookUrl } from "@/shared/webhook";
import { BackLink } from "./TrackerNew";

export function WeatherGuide() {
  const { id } = useParams<{ id: string }>();
  const [colony] = useColony(id);
  const [exists] = useWeatherTracker(id);

  if (colony === undefined || exists === undefined) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (!colony || !exists) return <p className="text-ink-soft">This colony doesn't track weather yet.</p>;
  return <Guide colonyId={colony.id} colonyName={colony.name} token={colony.webhook_token} />;
}

function Guide({ colonyId, colonyName, token }: { colonyId: string; colonyName: string; token: string }) {
  const navigate = useNavigate();
  const feed = useColonyFeed(colonyId);
  const origin = window.location.origin;
  const reporting = WEATHERS.filter((w) => feed.states.has(w.adapter)).length;

  const reportedAtLoad = useRef<Set<string> | null>(null);
  if (reportedAtLoad.current === null && !feed.loading) {
    reportedAtLoad.current = new Set(WEATHERS.filter((w) => feed.states.has(w.adapter)).map((w) => w.adapter));
  }

  async function remove() {
    const { error } = await supabase.from("weather_trackers").delete().eq("colony_id", colonyId);
    if (error) return toast.error(`Couldn't remove weather tracking: ${error.message}`);
    toast.success("Weather tracking removed");
    navigate(`/colonies/${colonyId}`);
  }

  return (
    <div>
      <BackLink colonyId={colonyId} name={colonyName} />
      <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Set up weather tracking</h1>

      <div className="mt-6 max-w-md">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {reporting} of {WEATHERS.length} stations reporting
          </span>
          {reporting === WEATHERS.length && <span className="text-cobalt-deep">All set</span>}
        </div>
        <Progress value={(reporting / WEATHERS.length) * 100} className="mt-2 h-2 bg-mist-2 [&>div]:bg-cobalt" />
      </div>

      <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-12">
          <section className="space-y-5">
            <h2 className="text-2xl font-bold tracking-tight">Links for every adapter</h2>
            <CopyField label="Call when switched on" what="On link" value={webhookUrl(origin, token, "on")} />
            <CopyField label="Call when switched off" what="Off link" value={webhookUrl(origin, token, "off")} />
          </section>

          <section>
            <h2 className="text-2xl font-bold tracking-tight">In your colony</h2>
            <ol className="mt-5 space-y-5">
              {[
                <>
                  Build three <strong>Weather Stations</strong> and set each one to a different weather:{" "}
                  <strong>Temperate</strong>, <strong>Drought</strong> and <strong>Badtide</strong>.
                </>,
                <>
                  Build an <strong>HTTP Adapter</strong> for each station. Click the pencil next to its name and rename
                  it to the adapter name from the list.
                </>,
                <>
                  On each adapter, press <strong>Automate</strong> and choose its station.
                </>,
                <>
                  Tick <strong>Call when switched on</strong> and <strong>Call when switched off</strong>, and paste the
                  two links. GET and POST both work.
                </>,
                <>
                  To see the current weather straight away, open the station for today's weather, switch it to another
                  weather, then switch it back. Its row lights up here.
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
          <h2 className="text-2xl font-bold tracking-tight">Stations</h2>
          <div className="mt-4 overflow-hidden rounded-xl border bg-paper">
            <Table>
              <TableHeader>
                <TableRow className="bg-mist-2/60 hover:bg-mist-2/60">
                  <TableHead className="pl-4">Station set to</TableHead>
                  <TableHead>Adapter name</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {WEATHERS.map((w) => {
                  const st = feed.states.get(w.adapter);
                  const fresh = !!st && reportedAtLoad.current !== null && !reportedAtLoad.current.has(w.adapter);
                  return (
                    <TableRow key={w.key} className={fresh ? "animate-in bg-resin-soft/60 duration-700 fade-in" : undefined}>
                      <TableCell className="pl-4">
                        <span className="inline-flex items-center gap-2.5">
                          <WeatherBadge weather={w.key} size="sm" />
                          {w.stationSetting}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-mono text-[13px]"
                          onClick={() => copyText(w.adapter, w.adapter)}
                          aria-label={`Copy adapter name ${w.adapter}`}
                        >
                          {w.adapter}
                          <Copy className="text-ink-soft" />
                        </Button>
                      </TableCell>
                      <TableCell className="pr-4 whitespace-nowrap">
                        {feed.loading ? (
                          <Skeleton className="h-4 w-24" />
                        ) : st ? (
                          <span className="inline-flex items-center gap-2">
                            <StatusDot state={st.state} live={fresh} />
                            {st.state ? "On" : "Off"}
                            <span className="text-ink-soft">{timeAgo(st.updated_at)}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-ink-soft">
                            <StatusDot state={undefined} /> Waiting
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t pt-8 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold">Stop tracking weather</h3>
              <p className="mt-1 text-sm text-ink-soft">The weather card goes away. Signals and their history stay.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="sm:ml-auto">
                  Stop tracking
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-display text-2xl font-bold tracking-tight">Stop tracking weather?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The weather card disappears from this colony. Signals from the stations are still recorded, so you
                    can turn it back on later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={remove} className="bg-danger text-white hover:bg-danger/90">
                    Stop tracking
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
