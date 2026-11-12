import { cn } from "@/lib/utils";

/** The player's picture, or the first letter of their name on heartwood when they have none. */
export function Avatar({ url, name, className }: { url: string | undefined; name: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-heartwood font-display font-bold text-mist uppercase",
        className,
      )}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : name.slice(0, 1)}
    </span>
  );
}
