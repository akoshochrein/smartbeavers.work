import { Biohazard, CloudSun, DropletOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Weather } from "@/shared/weather";

export const WEATHER_STYLE: Record<Weather, { icon: LucideIcon; badge: string; bar: string }> = {
  // Badge text colors chosen for contrast on each fill (white on green/purple, ink on amber).
  temperate: { icon: CloudSun, badge: "bg-temperate text-white", bar: "bg-temperate" },
  drought: { icon: DropletOff, badge: "bg-drought text-ink", bar: "bg-drought" },
  badtide: { icon: Biohazard, badge: "bg-badtide text-white", bar: "bg-badtide" },
};

const SIZES = {
  sm: "size-6 rounded-md [&_svg]:size-3.5",
  md: "size-9 rounded-lg [&_svg]:size-5",
  lg: "size-16 rounded-2xl [&_svg]:size-9",
};

/** Weather icon on its weather color. Always shown next to the weather's name. */
export function WeatherBadge({ weather, size = "md", className }: { weather: Weather; size?: keyof typeof SIZES; className?: string }) {
  const { icon: Icon, badge } = WEATHER_STYLE[weather];
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center", SIZES[size], badge, className)}>
      <Icon strokeWidth={2} />
    </span>
  );
}
