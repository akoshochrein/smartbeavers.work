import { createFileRoute } from "@tanstack/react-router";
import { TRACKER_KINDS, TrackerNew, type TrackerKind } from "@/pages/TrackerNew";

export const Route = createFileRoute("/_app/colonies/$id/trackers/new")({
  // ?kind=resource and so on. Without it the page asks what to track.
  validateSearch: (search: Record<string, unknown>): { kind?: TrackerKind } => {
    const kind = TRACKER_KINDS.find((k) => k === search.kind);
    return kind ? { kind } : {};
  },
  component: TrackerNew,
});
