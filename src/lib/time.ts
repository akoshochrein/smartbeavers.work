export function timeAgo(iso: string | number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - (typeof iso === "number" ? iso : Date.parse(iso))) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

const WEEK_MS = 6 * 86_400_000;

/** "Tue 09:44" within the last week, "Oct 12, 09:44" before that. */
export const formatTime = (t: number, now = Date.now()) =>
  new Date(t).toLocaleString(
    undefined,
    now - t < WEEK_MS
      ? { weekday: "short", hour: "2-digit", minute: "2-digit" }
      : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
  );

/** "Oct 12": for axis labels that only need the day. */
export const formatDay = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
