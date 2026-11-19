import type { ReactNode } from "react";

/**
 * A colony's sections, always in the same order: Time and weather, Population, Goods.
 * A section with nothing in it is left out. On wide screens Time and weather is a pane on the
 * left and the other two fill the right; on narrower screens they stack in that order.
 */
export function TrackerSections({ time, population, goods }: { time: ReactNode; population: ReactNode; goods: ReactNode }) {
  const rest = (!!population || !!goods) && (
    <div className="min-w-0 space-y-8">
      {population && <Section title="Population">{population}</Section>}
      {goods && <Section title="Goods">{goods}</Section>}
    </div>
  );
  if (!time || !rest) return <div className={time ? "max-w-2xl" : undefined}>{time ? <Section title="Time and weather">{time}</Section> : rest}</div>;
  return (
    <div className="grid gap-8 xl:grid-cols-[26rem_minmax(0,1fr)] xl:items-start">
      {/* Pinned under the status band; scrolls inside itself if it is taller than the window. */}
      <div className="xl:sticky xl:top-32 xl:max-h-[calc(100dvh-9rem)] xl:overflow-y-auto">
        <Section title="Time and weather">{time}</Section>
      </div>
      {rest}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">{title}</h2>
      {children}
    </section>
  );
}

/** Tiles keep their own height, so opening one doesn't stretch the tiles beside it. */
export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid items-start gap-4 sm:grid-cols-2 2xl:grid-cols-3">{children}</div>;
}
