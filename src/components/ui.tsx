import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-xl border border-bark-200 bg-white/70 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-semibold">{title}</h2>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
      {children}
    </section>
  );
}

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md bg-bark-700 px-3 py-1.5 text-sm text-bark-50 hover:bg-bark-900 disabled:opacity-50 ${className}`}
    />
  );
}

export function StateDot({ on }: { on: boolean }) {
  return (
    <span
      aria-label={on ? "on" : "off"}
      className={`inline-block size-2.5 rounded-full ${on ? "bg-moss-500" : "bg-bark-300"}`}
    />
  );
}

export function CopyField({ value }: { value: string }) {
  return (
    <div className="flex gap-2">
      <input readOnly value={value} className="min-w-0 flex-1 rounded-md border border-bark-200 bg-bark-50 px-2 py-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button type="button" onClick={() => navigator.clipboard.writeText(value)}>Copy</Button>
    </div>
  );
}
