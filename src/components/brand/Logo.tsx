import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const HEAD = "M32 15.5c8 0 13.5 4.5 16 12.5 2 6 2.5 9 2.5 11.5 0 8-7.5 12-18.5 12s-18.5-4-18.5-12c0-2.5.5-5.5 2.5-11.5 2.5-8 8-12.5 16-12.5Z";
const TEETH = "M25 41h6.5v7.5a2 2 0 0 1-2 2h-2.5a2 2 0 0 1-2-2zM32.5 41h6.5v7.5a2 2 0 0 1-2 2h-2.5a2 2 0 0 1-2-2z";
const COG =
  "M56.29 35.7L62.69 39.59A31.5 31.5 0 0 1 58.71 49.19L51.44 47.41A24.5 24.5 0 0 1 46.91 51.94L48.69 59.21A31.5 31.5 0 0 1 39.09 63.19L35.2 56.79A24.5 24.5 0 0 1 28.8 56.79L24.91 63.19A31.5 31.5 0 0 1 15.31 59.21L17.09 51.94A24.5 24.5 0 0 1 12.56 47.41L5.29 49.19A31.5 31.5 0 0 1 1.31 39.59L7.71 35.7A24.5 24.5 0 0 1 7.71 29.3L1.31 25.41A31.5 31.5 0 0 1 5.29 15.81L12.56 17.59A24.5 24.5 0 0 1 17.09 13.06L15.31 5.79A31.5 31.5 0 0 1 24.91 1.81L28.8 8.21A24.5 24.5 0 0 1 35.2 8.21L39.09 1.81A31.5 31.5 0 0 1 48.69 5.79L46.91 13.06A24.5 24.5 0 0 1 51.44 17.59L58.71 15.81A31.5 31.5 0 0 1 62.69 25.41L56.29 29.3A24.5 24.5 0 0 1 56.29 35.7Z";

/**
 * Beaver head with amber buck teeth inside an amber cog (source: src/assets/brand/mark.svg).
 * The head takes currentColor, so set text-mist on pine or text-pine/text-ink on mist.
 * Keep the amber teeth: without them the head reads as a bear. Use public/favicon.svg below 24px.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 64 64" fill="none" className={cn("size-8 shrink-0", className)} aria-hidden>
      <mask id={`ring-${id}`}>
        <rect width="64" height="64" fill="#fff" />
        <g fill="#000" stroke="#000" strokeWidth="4.4" strokeLinejoin="round">
          <path d={HEAD} />
          <circle cx="17.5" cy="21" r="4.5" />
          <circle cx="46.5" cy="21" r="4.5" />
        </g>
      </mask>
      <mask id={`face-${id}`}>
        <rect width="64" height="64" fill="#fff" />
        <g fill="#000">
          <circle cx="24" cy="29" r="2.7" />
          <circle cx="40" cy="29" r="2.7" />
          <rect x="26" y="33" width="12" height="6.5" rx="3.25" />
          <path d={TEETH} stroke="#000" strokeWidth="3.2" strokeLinejoin="round" />
          <rect x="23.4" y="46" width="17.2" height="10" />
        </g>
      </mask>
      <path fill="var(--color-resin)" mask={`url(#ring-${id})`} d={COG} />
      <g fill="currentColor" mask={`url(#face-${id})`}>
        <path d={HEAD} />
        <circle cx="17.5" cy="21" r="4.5" />
        <circle cx="46.5" cy="21" r="4.5" />
      </g>
      <path fill="var(--color-resin)" d={TEETH} />
    </svg>
  );
}

export function Logo({ to = "/", className }: { to?: "/" | "/dashboard"; className?: string }) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2 rounded-md", className)} aria-label="smartbeavers home">
      <LogoMark className="size-[1.7rem]" />
      <span className="font-display text-[1.45rem] leading-none font-extrabold tracking-tight">smartbeavers</span>
    </Link>
  );
}
