import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button, Card, CopyField } from "../components/ui";
import { supabase } from "../lib/supabase";
import { timeAgo } from "../lib/time";
import { useColony, useLadders } from "../lib/useColony";
import { useColonyFeed } from "../lib/useColonyFeed";
import { comparisonSymbol, ladderSteps, metricFor, type Comparison } from "../shared/ladders";
import { webhookUrl } from "../shared/webhook";

export function TrackerGuide() {
  const { id, ladderId } = useParams<{ id: string; ladderId: string }>();
  const [colony] = useColony(id);
  const ladders = useLadders(id);

  if (colony === undefined || ladders === undefined) return <p className="text-bark-500">Loading…</p>;
  const ladder = ladders.find((l) => l.id === ladderId);
  if (!colony || !ladder) return <p className="text-bark-500">Tracker not found.</p>;

  return <Guide colonyId={colony.id} colonyName={colony.name} token={colony.webhook_token} ladder={ladder} />;
}

function Guide({ colonyId, colonyName, token, ladder }: {
  colonyId: string;
  colonyName: string;
  token: string;
  ladder: NonNullable<ReturnType<typeof useLadders>>[number];
}) {
  const navigate = useNavigate();
  const feed = useColonyFeed(colonyId);
  const metric = metricFor(ladder.metric);
  const symbol = comparisonSymbol(ladder.comparison as Comparison);
  const steps = useMemo(() => ladderSteps(ladder, (n) => feed.states.get(n)?.state), [ladder, feed.states]);
  const reporting = steps.filter((s) => s.state !== undefined).length;
  const [error, setError] = useState<string>();
  const origin = window.location.origin;

  async function remove() {
    if (!confirm(`Delete the ${metric.label} tracker? Adapter history is kept.`)) return;
    const { error } = await supabase.from("ladders").delete().eq("id", ladder.id);
    if (error) setError(error.message);
    else navigate(`/colonies/${colonyId}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/colonies/${colonyId}`} className="text-sm text-river-700 hover:underline">← {colonyName}</Link>
        <h1 className="mt-1 text-2xl font-bold">{metric.label} tracker: setup guide</h1>
      </div>

      <Card title="Before you start">
        <ul className="list-disc space-y-1 pl-5 text-sm text-bark-700">
          <li>Unlock the <strong>Population Counter</strong> and the <strong>HTTP Adapter</strong> in the science tree.</li>
          <li>Every adapter in this tracker uses the same two URLs. The game fills in each adapter's name.</li>
        </ul>
        <div className="mt-4 space-y-2">
          <label className="block text-xs text-bark-500">Call when switched on</label>
          <CopyField value={webhookUrl(origin, token, "on")} />
          <label className="block text-xs text-bark-500">Call when switched off</label>
          <CopyField value={webhookUrl(origin, token, "off")} />
        </div>
      </Card>

      <Card title="For each row below">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-bark-700">
          <li>
            Build a <strong>Population Counter</strong>. Set it to count <strong>{metric.counterSetting}</strong>, with
            the comparison <strong className="font-mono">{symbol}</strong> and the row's value. Count the whole colony or one
            district, but use the same scope on every counter.
          </li>
          <li>
            Build an <strong>HTTP Adapter</strong>. Click the pencil next to its name and rename it to exactly the row's
            adapter name. Capital letters matter.
          </li>
          <li>On the adapter, press <strong>Automate</strong> and pick that row's counter as its input.</li>
          <li>
            Tick <strong>Call when switched on</strong> and <strong>Call when switched off</strong>, and paste the two
            URLs above. GET or POST both work.
          </li>
          <li>
            <strong>Optional, to see it report right away:</strong> adapters only call us when their signal changes. Set the
            counter's value to <span className="font-mono">0</span>, then <span className="font-mono">9999</span>, then back to
            the row's value. The row below lights up.
          </li>
        </ol>
      </Card>

      <Card title="Counters" actions={<span className="text-xs text-bark-500">{reporting} of {steps.length} reporting</span>}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-bark-500">
              <tr>
                <th className="px-5 py-2 font-normal">Population Counter</th>
                <th className="px-2 py-2 font-normal">HTTP Adapter name</th>
                <th className="px-5 py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bark-100">
              {steps.map((s) => {
                const st = feed.states.get(s.name);
                return (
                  <tr key={s.name}>
                    <td className="whitespace-nowrap px-5 py-2">
                      {metric.counterSetting} <span className="font-mono">{symbol} {s.threshold}</span>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(s.name)}
                        title="Copy name"
                        className="rounded bg-bark-100 px-2 py-0.5 font-mono text-xs hover:bg-bark-200"
                      >
                        {s.name}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-5 py-2">
                      {feed.loading ? (
                        <span className="text-bark-500">…</span>
                      ) : st ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden className={`size-2 rounded-full ${st.state ? "bg-chart" : "bg-bark-300"}`} />
                          {st.state ? "On" : "Off"}
                          <span className="text-xs text-bark-500">· {timeAgo(st.updated_at)}</span>
                        </span>
                      ) : (
                        <span className="text-bark-500">Waiting for first signal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {error && <p className="text-sm text-ember-500">{error}</p>}
      <Button onClick={remove} className="bg-ember-500 hover:bg-ember-500/80">Delete tracker</Button>
    </div>
  );
}
