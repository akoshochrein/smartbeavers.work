import { BarChart3, CloudSun, Radio, ToggleRight } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "@/components/brand/Logo";
import { SiteFooter } from "@/components/PublicPage";
import { AdapterDemo, LeverDemo } from "@/components/landing/Demos";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const FEATURES = [
  {
    icon: ToggleRight,
    title: "Switch levers",
    body: "Every HTTP Lever in your colony gets a switch in the browser. Handy for floodgates, work shifts or anything you've wired to a lever.",
    where: "Works in a browser on the computer running the game.",
  },
  {
    icon: Radio,
    title: "See every signal",
    body: "Paste your colony's two links into an HTTP Adapter and each on or off is recorded with the time it happened.",
    where: "Works anywhere, including your phone.",
  },
  {
    icon: BarChart3,
    title: "Track numbers",
    body: "Wire a few Population Counters to adapters and smartbeavers turns them into a number, like your population, free beds, vacancies or contaminated beavers.",
    where: "Works anywhere, with 180 days of history.",
  },
  {
    icon: CloudSun,
    title: "Follow the weather",
    body: "Three Weather Stations tell smartbeavers whether it's temperate, a drought or a badtide, with a log and a count of each.",
    where: "Works anywhere, so you know when to head back.",
  },
];

const QUESTIONS = [
  {
    q: "Do I need mods?",
    a: "No. You only need the HTTP Lever and HTTP Adapter, which you unlock in the game's science tree.",
  },
  {
    q: "Can I switch levers from my phone?",
    a: "Not yet. The game only takes lever commands from the computer it's running on, so switching levers works in a browser on that computer. Signals and trackers work anywhere.",
  },
  {
    q: "What do you store?",
    a: "Your colony names, your adapters' names, and when each adapter switched on or off. Nothing from your save files.",
  },
  {
    q: "What if someone gets my links?",
    a: "Make new ones in the colony's settings. The old links stop working straight away.",
  },
];

export function Home() {
  const { session } = useAuth();
  const start = session ? "/dashboard" : "/login";
  const startLabel = session ? "Open your colonies" : "Sign in to get started";

  return (
    <div className="min-h-dvh bg-mist">
      <header className="mx-auto flex max-w-5xl items-center px-5 py-5 sm:px-8">
        <Logo />
        <Button asChild variant="outline" className="ml-auto bg-paper">
          <Link to={start}>{session ? "Your colonies" : "Sign in"}</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-5 sm:px-8">
        <section className="pt-10 pb-12 sm:pt-16">
          <h1 className="max-w-3xl text-[2.25rem] leading-[1.1] font-bold tracking-tight sm:text-[2.75rem]">
            Use Timberborn's HTTP buildings without writing code
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
            smartbeavers gives your HTTP Levers a switch in your browser and gives your HTTP Adapters a place to report
            to. Set it up once, then check on your colony from any device.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button asChild size="lg" className="h-11 px-5 text-base">
              <Link to={start}>{startLabel}</Link>
            </Button>
            <a href="#how" className="text-cobalt-deep underline-offset-4 hover:underline">
              How setup works
            </a>
          </div>
        </section>

        <section aria-labelledby="buildings" className="pb-20">
          <h2 id="buildings" className="text-2xl font-bold tracking-tight sm:text-3xl">The two HTTP buildings</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">
            One lets the outside world switch something in your colony. The other tells the outside world when something
            changed. Try them both.
          </p>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <LeverDemo />
            <AdapterDemo />
          </div>
        </section>

        <section aria-labelledby="features" className="border-t border-ink/10 py-20">
          <h2 id="features" className="text-2xl font-bold tracking-tight sm:text-3xl">What you can do</h2>
          <ul className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body, where }) => (
              <li key={title}>
                <Icon className="size-6 text-cobalt-deep" strokeWidth={1.75} />
                <h3 className="mt-3 text-xl font-semibold">{title}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{body}</p>
                <p className="mt-3 text-sm text-ink">{where}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" aria-labelledby="setup" className="scroll-mt-8 border-t border-ink/10 py-20">
          <h2 id="setup" className="text-2xl font-bold tracking-tight sm:text-3xl">How setup works</h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {[
              ["Create a colony", "Sign in with your email and add a colony for your save. You'll get two links that belong to it."],
              ["Paste the links into your adapters", "In each HTTP Adapter, tick both boxes and paste the links. The game fills in the adapter's name."],
              ["Watch it arrive", "Signals show up in your dashboard as they happen. Add trackers or switch levers whenever you like."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pine font-display text-base font-bold text-mist">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-xl font-semibold leading-snug">{title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-soft">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Button asChild size="lg" className="mt-12 h-11 px-5 text-base">
            <Link to={start}>{startLabel}</Link>
          </Button>
        </section>

        <section aria-labelledby="questions" className="border-t border-ink/10 py-20">
          <h2 id="questions" className="text-2xl font-bold tracking-tight sm:text-3xl">Questions</h2>
          <dl className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {QUESTIONS.map(({ q, a }) => (
              <div key={q}>
                <dt className="font-bold">{q}</dt>
                <dd className="mt-1.5 leading-relaxed text-ink-soft">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
