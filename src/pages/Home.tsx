import { Link } from "react-router";
import { useAuth } from "../lib/auth";

export function Home() {
  const { session } = useAuth();
  return (
    <div className="space-y-10 py-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Automate your colony from the browser.</h1>
        <p className="max-w-2xl text-lg text-bark-700">
          Smart Beavers connects to Timberborn's HTTP Levers and HTTP Adapters. Flip levers, watch adapter
          signals live, and keep a history of what your colony is doing, all without writing scripts.
        </p>
        <Link
          to={session ? "/dashboard" : "/login"}
          className="inline-block rounded-md bg-river-700 px-4 py-2 text-white hover:bg-river-500"
        >
          {session ? "Go to your colonies" : "Get started"}
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Control levers", "Toggle HTTP Levers and set their colours straight from this page."],
          ["Webhook inbox", "Point HTTP Adapters at your personal URL and see every on/off signal."],
          ["Live state", "Adapter states stream to your dashboard in real time."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-xl border border-bark-200 bg-white/70 p-4">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-bark-700">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
