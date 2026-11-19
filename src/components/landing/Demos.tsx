import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Signal dots in flight. Each dot is delivered exactly once, even if an animation reports twice. */
function usePulses() {
  const [pulses, setPulses] = useState<{ id: number; on: boolean }[]>([]);
  const next = useRef(0);
  const delivered = useRef(new Set<number>());
  return {
    ids: pulses.map((p) => p.id),
    send(on: boolean) {
      const id = next.current++;
      setPulses((all) => [...all, { id, on }]);
    },
    /** Returns the pulse the first time it lands, undefined after that. */
    land(id: number) {
      if (delivered.current.has(id)) return undefined;
      delivered.current.add(id);
      const pulse = pulses.find((p) => p.id === id);
      setPulses((all) => all.filter((p) => p.id !== id));
      return pulse;
    },
  };
}

/** A dashed wire with signal dots travelling along it. Each dot calls onArrive when it lands. */
function Wire({ pulses, direction, onArrive }: { pulses: number[]; direction: "right" | "left"; onArrive: (id: number) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative h-6 min-w-8 flex-1" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-ink/20" />
      <div
        className={cn(
          "absolute top-1/2 size-0 -translate-y-1/2 border-y-[5px] border-y-transparent",
          direction === "right" ? "right-0 border-l-[7px] border-l-ink/30" : "left-0 border-r-[7px] border-r-ink/30",
        )}
      />
      <AnimatePresence>
        {pulses.map((id) => (
          <motion.span
            key={id}
            className="absolute top-1/2 -mt-[6px] size-3 rounded-full bg-resin shadow-[0_0_0_4px_rgb(242_179_61/0.25)]"
            initial={{ left: direction === "right" ? "0%" : "100%", opacity: 1 }}
            animate={{ left: direction === "right" ? "100%" : "0%" }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.7, ease: "easeInOut" }}
            onAnimationComplete={() => onArrive(id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Shows a request path that may only wrap after a slash. */
function Path({ text }: { text: string }) {
  const parts = text.split("/");
  return (
    <code className="font-mono text-ink">
      {parts.map((p, i) => (
        <span key={i} className="whitespace-nowrap">
          {p}
          {i < parts.length - 1 && "/"}
          {i < parts.length - 1 && <wbr />}
        </span>
      ))}
    </code>
  );
}

function End({ label, dark, children }: { label: string; dark?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex w-[7.25rem] shrink-0 flex-col items-center gap-2 rounded-xl p-2.5 text-center sm:w-36 sm:p-3",
        dark ? "bg-pine text-mist" : "border bg-paper",
      )}
    >
      <div className={cn("text-xs", dark ? "text-sage" : "text-ink-soft")}>{label}</div>
      {children}
    </div>
  );
}

function DemoCard({ title, summary, children, request }: { title: string; summary: string; children: ReactNode; request: ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl border bg-paper/60 p-4 sm:p-6">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-1 text-ink-soft">{summary}</p>
      <div className="mt-6 flex items-center gap-2">{children}</div>
      <div className="mt-5 min-h-[3.25rem] rounded-lg bg-mist-2/70 px-3 py-2 text-[13px] leading-relaxed text-ink-soft">{request}</div>
    </section>
  );
}

export function AdapterDemo() {
  const [signal, setSignal] = useState(false);
  const [log, setLog] = useState<{ id: number; on: boolean }[]>([]);
  const [last, setLast] = useState<boolean>();
  const pulses = usePulses();

  function change() {
    const on = !signal;
    setSignal(on);
    setLast(on);
    pulses.send(on);
  }

  return (
    <DemoCard
      title="HTTP Adapter"
      summary="It tells something outside the game whenever its signal changes. smartbeavers gives it somewhere to report."
      request={
        last === undefined ? (
          <>Change the signal. You'll see the request the game sends to smartbeavers.</>
        ) : (
          <>
            The game sent <Path text={`GET smartbeavers.work/hook/…/${last ? "on" : "off"}/LogsFull`} />
          </>
        )
      }
    >
      <End label="In your colony" dark>
        <div className="flex h-14 items-center">
          <span
            className={cn(
              "size-5 rounded-full border-2 transition-colors duration-300",
              signal ? "border-resin bg-resin" : "border-sage bg-transparent",
            )}
          />
        </div>
        <Button size="sm" variant="secondary" onClick={change} className="h-7 bg-pine-soft text-xs text-mist hover:bg-pine-soft/80">
          {signal ? "Turn signal off" : "Turn signal on"}
        </Button>
      </End>
      <Wire
        direction="right"
        pulses={pulses.ids}
        onArrive={(id) => {
          const p = pulses.land(id);
          if (p) setLog((l) => [{ id, on: p.on }, ...l].slice(0, 3));
        }}
      />
      <End label="smartbeavers">
        <ul className="flex h-[4.75rem] w-full flex-col gap-1 overflow-hidden text-left text-[11px]">
          <AnimatePresence initial={false}>
            {log.length === 0 && (
              <li key="empty" className="pt-5 text-center text-ink-soft">
                No signals yet
              </li>
            )}
            {log.map((e, i) => (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: i === 0 ? 1 : 0.6, y: 0 }}
                className="flex items-center gap-1.5 rounded bg-mist-2/80 px-1.5 py-0.5"
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", e.on ? "bg-cobalt" : "bg-ink/30")} />
                <span className="font-mono">LogsFull</span>
                <span className="ml-auto text-ink-soft">{e.on ? "on" : "off"}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </End>
    </DemoCard>
  );
}
