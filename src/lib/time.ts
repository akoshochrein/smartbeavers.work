export function timeAgo(iso: string | number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - (typeof iso === "number" ? iso : Date.parse(iso))) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export const formatTime = (t: number) =>
  new Date(t).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
